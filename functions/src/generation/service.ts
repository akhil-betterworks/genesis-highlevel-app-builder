import { logger } from 'firebase-functions'
import { FieldValue } from 'firebase-admin/firestore'
import type { Request, Response } from 'express'
import { z } from 'zod'
import { LIMITS } from '../config'
import { db, paths } from '../lib/firestore'
import { AppError, toAppError } from '../lib/errors'
import { SseWriter } from '../lib/sse'
import { enforceRateLimit, RATE_RULES } from '../lib/rateLimit'
import { getConnectionStatus } from '../highlevel/tokens'
import { hlGet } from '../highlevel/api'
import { getProjectOrThrow, readFiles, stageReplaceFiles, stageSnapshot } from '../projects/repo'
import { applyOps, validateFileContent, validatePath, type FileOp } from './files'
import { StreamParser } from './parser'
import { SYSTEM_PROMPT, boundHistory, buildUserMessage, type ContextInput } from './prompt'
import { getProvider } from './llm'

const Body = z.object({ prompt: z.string().trim().min(1).max(LIMITS.maxPromptChars) })
const LOCK_MS = 10 * 60 * 1000

async function gatherHlContext(uid: string): Promise<ContextInput['hl']> {
  const status = await getConnectionStatus(uid)
  if (!status.connected) return { connected: false }
  if (status.needsReauth) return { connected: false, note: 'HighLevel authorization expired; user must reconnect.' }
  const out: ContextInput['hl'] = { connected: true, locationName: status.locationName }
  const results = await Promise.allSettled([
    hlGet<{ calendars?: { id: string; name: string }[] }>(uid, '/calendars/'),
    hlGet<{ meta?: { total?: number } }>(uid, '/contacts/', { limit: 1 }),
  ])
  if (results[0].status === 'fulfilled') {
    out.calendars = (results[0].value.calendars ?? []).slice(0, 20).map((c) => ({ id: c.id, name: c.name }))
  }
  if (results[1].status === 'fulfilled') out.contactTotal = results[1].value.meta?.total ?? null
  const failed = results.filter((r) => r.status === 'rejected').length
  if (failed) out.note = 'Some HighLevel metadata could not be fetched; generate defensive code.'
  return out
}

async function acquireLock(uid: string, pid: string, generationId: string) {
  const ref = paths.project(uid, pid)
  await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const lock = snap.data()?.generationLock as { id: string; until: number } | undefined
    if (lock && lock.until > Date.now()) {
      throw new AppError('conflict', 'A generation is already running for this project')
    }
    tx.update(ref, { generationLock: { id: generationId, until: Date.now() + LOCK_MS } })
  })
}

const releaseLock = (uid: string, pid: string) =>
  paths.project(uid, pid).update({ generationLock: FieldValue.delete() }).catch(() => undefined)

/**
 * POST /projects/:pid/generate  — streams an SSE response.
 * Lifecycle: validate → lock → context → stream LLM (parse files live) → apply validated ops →
 * snapshot → persist generation + chat messages → done. On any failure, completed files are still
 * applied and the raw output is preserved on the generation document.
 */
export async function streamGeneration(uid: string, pid: string, req: Request, res: Response) {
  const { prompt } = Body.parse(req.body)
  await enforceRateLimit(uid, RATE_RULES.generate)
  const project = await getProjectOrThrow(uid, pid)

  const genRef = paths.generations(uid, pid).doc()
  await acquireLock(uid, pid, genRef.id)

  const sse = new SseWriter(res)
  const abort = new AbortController()
  let cancelReason: 'client_disconnected' | 'user_cancelled' | null = null
  res.on('close', () => {
    if (!res.writableFinished && !abort.signal.aborted) {
      cancelReason ??= 'client_disconnected'
      abort.abort()
    }
  })
  const unsubscribeCancel = genRef.onSnapshot(
    (s) => {
      if (s.data()?.cancelRequested && !abort.signal.aborted) {
        cancelReason = 'user_cancelled'
        abort.abort()
      }
    },
    () => undefined,
  )

  let raw = ''
  const ops: FileOp[] = []
  let summary = ''
  let partialFile: { path: string; content: string } | undefined
  let failure: ReturnType<typeof toAppError> | null = null
  let stopReason: string | null = null
  let usage: unknown

  try {
    sse.send('meta', { generationId: genRef.id, projectId: pid })
    await genRef.set({ prompt, status: 'streaming', createdAt: FieldValue.serverTimestamp(), model: null })
    await paths.messages(uid, pid).add({
      role: 'user',
      content: prompt,
      generationId: genRef.id,
      createdAt: FieldValue.serverTimestamp(),
    })

    sse.send('status', { stage: 'context', message: 'Gathering project and HighLevel context…' })
    const [files, historySnap, hl] = await Promise.all([
      readFiles(uid, pid),
      paths.messages(uid, pid).orderBy('createdAt', 'desc').limit(LIMITS.historyMessages + 1).get(),
      gatherHlContext(uid).catch((e) => {
        logger.warn('HL context failed', { e: String(e) })
        return { connected: false, note: 'HighLevel context unavailable' } as ContextInput['hl']
      }),
    ])
    const history = historySnap.docs
      .reverse()
      .filter((d) => d.data().generationId !== genRef.id)
      .map((d) => ({ role: d.data().role as 'user' | 'assistant', content: String(d.data().content ?? '') }))

    const userMessage = buildUserMessage({
      files,
      history,
      hl,
      project: { name: String(project.name), description: String(project.description ?? '') },
      prompt,
    })

    sse.send('status', { stage: 'generating', message: 'Generating…' })
    const parser = new StreamParser()
    const handle = (text: string) => {
      raw += text
      sse.send('token', { text })
      for (const ev of parser.push(text)) {
        switch (ev.type) {
          case 'file_start':
            sse.send('file_start', { path: ev.path })
            break
          case 'file_delta':
            sse.send('file_delta', { path: ev.path, text: ev.text })
            break
          case 'file_end':
            ops.push({ op: 'write', path: ev.path, content: ev.content })
            sse.send('file_end', { path: ev.path, bytes: Buffer.byteLength(ev.content) })
            break
          case 'delete':
            ops.push({ op: 'delete', path: ev.path })
            sse.send('file_delete', { path: ev.path })
            break
          case 'summary':
            summary = ev.text
            break
        }
      }
    }

    const result = await getProvider().stream(
      { system: SYSTEM_PROMPT, messages: [...boundHistory(history), { role: 'user', content: userMessage }], signal: abort.signal },
      handle,
    )
    stopReason = result.stopReason
    usage = result.usage
    const fin = parser.finish()
    summary ||= fin.summary
    partialFile = fin.partialFile

    if (abort.signal.aborted) {
      failure = new AppError('internal', cancelReason === 'user_cancelled' ? 'Generation cancelled' : 'Connection lost')
    } else if (stopReason === 'max_tokens') {
      failure = new AppError('llm_error', 'The response hit the model output limit; completed files were kept.')
    } else if (!ops.length && !summary) {
      failure = new AppError('llm_error', 'The model response did not contain any files (malformed output).')
    }
  } catch (err) {
    failure = toAppError(err)
    logger.error('Generation failed', { uid, pid, err: String(err) })
  } finally {
    unsubscribeCancel()
  }

  // ---- Persist whatever we have (partial results are never discarded) ----
  let snapshotId: string | null = null
  let changes: ReturnType<typeof applyOps>['changes'] = []
  let applyError: string | null = null
  try {
    sse.send('status', { stage: 'applying', message: 'Saving files and creating snapshot…' })
    const current = await readFiles(uid, pid)
    const valid: FileOp[] = []
    const rejected: string[] = []
    for (const op of ops) {
      try {
        validatePath(op.path)
        if (op.op === 'write') validateFileContent(op.path, op.content)
        valid.push(op)
      } catch {
        rejected.push(op.path)
      }
    }
    if (rejected.length) applyError = `Rejected invalid file paths: ${rejected.join(', ')}`
    const applied = applyOps(current, valid)
    changes = applied.changes

    const status = failure
      ? cancelReason === 'user_cancelled'
        ? 'cancelled'
        : changes.length
          ? 'partial'
          : 'failed'
      : 'completed'

    const batch = db().batch()
    if (changes.length) {
      await stageReplaceFiles(batch, uid, pid, applied.files, 'ai')
      snapshotId = stageSnapshot(batch, uid, pid, applied.files, {
        reason: 'generation',
        label: prompt.slice(0, 80),
        generationId: genRef.id,
      })
      batch.update(paths.project(uid, pid), {
        fileCount: applied.files.length,
        currentSnapshotId: snapshotId,
        updatedAt: FieldValue.serverTimestamp(),
      })
    }
    const assistantText =
      summary ||
      (failure ? failure.message : changes.length ? `Updated ${changes.length} file(s).` : 'No file changes were produced.')
    batch.set(genRef, {
      prompt,
      status,
      summary: assistantText,
      rawOutput: raw.slice(0, 600_000),
      partialFile: partialFile ? { path: partialFile.path, content: partialFile.content.slice(0, 200_000) } : null,
      changes: changes.map((c) => ({ path: c.path, type: c.type })),
      diff: JSON.stringify(changes).length < 700_000 ? changes : null,
      snapshotId,
      stopReason,
      usage: usage ?? null,
      error: failure ? { code: failure.code, message: failure.message } : applyError ? { code: 'invalid_argument', message: applyError } : null,
      finishedAt: FieldValue.serverTimestamp(),
    }, { merge: true })
    batch.set(paths.messages(uid, pid).doc(), {
      role: 'assistant',
      content: assistantText,
      generationId: genRef.id,
      status,
      changes: changes.map((c) => ({ path: c.path, type: c.type })),
      createdAt: FieldValue.serverTimestamp(),
    })
    await batch.commit()

    if (failure) {
      sse.send('error', {
        code: failure.code,
        message: failure.message,
        recoverable: failure.code !== 'unauthenticated',
        partial: changes.length > 0,
        generationId: genRef.id,
        snapshotId,
      })
    }
    sse.send('done', {
      generationId: genRef.id,
      snapshotId,
      status,
      summary: assistantText,
      warning: applyError,
      changes: changes.map((c) => ({ path: c.path, type: c.type })),
    })
  } catch (err) {
    const e = toAppError(err)
    logger.error('Failed to persist generation', { err: String(err) })
    await genRef.set({ status: 'failed', rawOutput: raw.slice(0, 600_000), error: { code: e.code, message: e.message } }, { merge: true }).catch(() => undefined)
    sse.send('error', { code: e.code, message: `Could not save generated files: ${e.message}`, recoverable: true, partial: false })
  } finally {
    await releaseLock(uid, pid)
    sse.end()
  }
}

export async function requestCancel(uid: string, pid: string, gid: string) {
  await getProjectOrThrow(uid, pid)
  const ref = paths.generations(uid, pid).doc(gid)
  const snap = await ref.get()
  if (!snap.exists) throw new AppError('not_found', 'Generation not found')
  if (snap.data()?.status === 'streaming') await ref.update({ cancelRequested: true })
  return { ok: true }
}
