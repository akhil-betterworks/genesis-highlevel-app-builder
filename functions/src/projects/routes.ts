import express, { type Router } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { z } from 'zod'
import { db, fileId, paths } from '../lib/firestore'
import { AppError } from '../lib/errors'
import { handler } from '../lib/http'
import { getConnectionStatus } from '../highlevel/tokens'
import { getProjectOrThrow, readFiles, restoreSnapshot, stageReplaceFiles, stageSnapshot } from './repo'
import { languageFor, validateFileContent, validatePath, validateProject } from '../generation/files'
import { requestCancel, streamGeneration } from '../generation/service'

const ProjectInput = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(1000).optional().default(''),
})
const ProjectPatch = ProjectInput.partial()
const SaveFile = z.object({ path: z.string().min(1).max(120), content: z.string().max(200_000) })
const RenameFile = z.object({ from: z.string(), to: z.string() })

const ts = (v: unknown) => (v && typeof v === 'object' && 'toMillis' in v ? (v as { toMillis(): number }).toMillis() : null)

function serializeProject(id: string, d: FirebaseFirestore.DocumentData) {
  return {
    id,
    name: d.name,
    description: d.description ?? '',
    hlLocationId: d.hlLocationId ?? null,
    hlLocationName: d.hlLocationName ?? null,
    fileCount: d.fileCount ?? 0,
    currentSnapshotId: d.currentSnapshotId ?? null,
    generating: Boolean(d.generationLock && d.generationLock.until > Date.now()),
    createdAt: ts(d.createdAt),
    updatedAt: ts(d.updatedAt),
  }
}

export function projectRoutes(): Router {
  const r = express.Router()

  r.get(
    '/projects',
    handler(async (req, res) => {
      const snap = await paths.projects(req.uid).where('deletedAt', '==', null).orderBy('updatedAt', 'desc').limit(100).get()
      res.json({ projects: snap.docs.map((d) => serializeProject(d.id, d.data())) })
    }),
  )

  r.post(
    '/projects',
    handler(async (req, res) => {
      const input = ProjectInput.parse(req.body)
      const hl = await getConnectionStatus(req.uid)
      const ref = paths.projects(req.uid).doc()
      const batch = db().batch()
      batch.set(ref, {
        ...input,
        ownerId: req.uid,
        hlLocationId: hl.connected ? hl.locationId : null,
        hlLocationName: hl.connected ? hl.locationName : null,
        fileCount: 0,
        deletedAt: null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      const snapId = stageSnapshot(batch, req.uid, ref.id, [], { reason: 'initial', label: 'Project created' })
      batch.update(ref, { currentSnapshotId: snapId })
      await batch.commit()
      const created = await ref.get()
      res.status(201).json({ project: serializeProject(ref.id, created.data()!) })
    }),
  )

  r.get(
    '/projects/:pid',
    handler(async (req, res) => {
      const p = await getProjectOrThrow(req.uid, req.params.pid)
      res.json({ project: serializeProject(p.id, p) })
    }),
  )

  r.patch(
    '/projects/:pid',
    handler(async (req, res) => {
      await getProjectOrThrow(req.uid, req.params.pid)
      const patch = ProjectPatch.parse(req.body)
      const update: Record<string, unknown> = { ...patch, updatedAt: FieldValue.serverTimestamp() }
      if ((req.body as { relinkLocation?: boolean })?.relinkLocation) {
        const hl = await getConnectionStatus(req.uid)
        update.hlLocationId = hl.connected ? hl.locationId : null
        update.hlLocationName = hl.connected ? hl.locationName : null
      }
      await paths.project(req.uid, req.params.pid).update(update)
      const d = (await paths.project(req.uid, req.params.pid).get()).data()!
      res.json({ project: serializeProject(req.params.pid, d) })
    }),
  )

  r.delete(
    '/projects/:pid',
    handler(async (req, res) => {
      await getProjectOrThrow(req.uid, req.params.pid)
      await paths.project(req.uid, req.params.pid).update({ deletedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() })
      res.json({ ok: true })
    }),
  )

  // ---------- Files ----------
  r.get(
    '/projects/:pid/files',
    handler(async (req, res) => {
      await getProjectOrThrow(req.uid, req.params.pid)
      const withContent = req.query.content === '1'
      const snap = await paths.files(req.uid, req.params.pid).get()
      const files = snap.docs
        .map((d) => {
          const x = d.data()
          return {
            path: x.path as string,
            language: x.language as string,
            size: x.size as number,
            updatedBy: x.updatedBy as string,
            updatedAt: ts(x.updatedAt),
            ...(withContent ? { content: x.content as string } : {}),
          }
        })
        .sort((a, b) => a.path.localeCompare(b.path))
      res.json({ files })
    }),
  )

  r.get(
    '/projects/:pid/file',
    handler(async (req, res) => {
      await getProjectOrThrow(req.uid, req.params.pid)
      const path = validatePath(String(req.query.path ?? ''))
      const doc = await paths.files(req.uid, req.params.pid).doc(fileId(path)).get()
      if (!doc.exists) throw new AppError('not_found', 'File not found')
      const x = doc.data()!
      res.json({ file: { path: x.path, content: x.content, language: x.language, size: x.size, updatedAt: ts(x.updatedAt) } })
    }),
  )

  r.put(
    '/projects/:pid/file',
    handler(async (req, res) => {
      const project = await getProjectOrThrow(req.uid, req.params.pid)
      if (((project.generationLock as { until: number } | undefined)?.until ?? 0) > Date.now()) {
        throw new AppError('conflict', 'Files are read-only while a generation is running')
      }
      const { content } = SaveFile.parse(req.body)
      const path = validatePath(SaveFile.parse(req.body).path)
      validateFileContent(path, content)
      const current = await readFiles(req.uid, req.params.pid)
      const next = [...current.filter((f) => f.path !== path), { path, content }]
      validateProject(next)
      const ref = paths.files(req.uid, req.params.pid).doc(fileId(path))
      await ref.set({
        path,
        content,
        language: languageFor(path),
        size: Buffer.byteLength(content, 'utf8'),
        updatedBy: 'user',
        updatedAt: FieldValue.serverTimestamp(),
      })
      await paths.project(req.uid, req.params.pid).update({ fileCount: next.length, updatedAt: FieldValue.serverTimestamp() })
      res.json({ ok: true, path })
    }),
  )

  r.delete(
    '/projects/:pid/file',
    handler(async (req, res) => {
      await getProjectOrThrow(req.uid, req.params.pid)
      const path = validatePath(String(req.query.path ?? ''))
      await paths.files(req.uid, req.params.pid).doc(fileId(path)).delete()
      const count = (await paths.files(req.uid, req.params.pid).count().get()).data().count
      await paths.project(req.uid, req.params.pid).update({ fileCount: count, updatedAt: FieldValue.serverTimestamp() })
      res.json({ ok: true })
    }),
  )

  r.post(
    '/projects/:pid/file/rename',
    handler(async (req, res) => {
      await getProjectOrThrow(req.uid, req.params.pid)
      const body = RenameFile.parse(req.body)
      const from = validatePath(body.from)
      const to = validatePath(body.to)
      const files = await readFiles(req.uid, req.params.pid)
      if (!files.some((f) => f.path === from)) throw new AppError('not_found', 'File not found')
      if (files.some((f) => f.path === to)) throw new AppError('conflict', 'Target file already exists')
      const next = files.map((f) => (f.path === from ? { ...f, path: to } : f))
      const batch = db().batch()
      await stageReplaceFiles(batch, req.uid, req.params.pid, next, 'user')
      await batch.commit()
      res.json({ ok: true })
    }),
  )

  // ---------- Snapshots ----------
  r.get(
    '/projects/:pid/snapshots',
    handler(async (req, res) => {
      await getProjectOrThrow(req.uid, req.params.pid)
      const snap = await paths
        .snapshots(req.uid, req.params.pid)
        .orderBy('createdAt', 'desc')
        .select('label', 'reason', 'fileCount', 'bytes', 'generationId', 'restoredFrom', 'createdAt')
        .limit(100)
        .get()
      res.json({
        snapshots: snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: ts(d.data().createdAt) })),
      })
    }),
  )

  r.get(
    '/projects/:pid/snapshots/:sid',
    handler(async (req, res) => {
      await getProjectOrThrow(req.uid, req.params.pid)
      const d = await paths.snapshots(req.uid, req.params.pid).doc(req.params.sid).get()
      if (!d.exists) throw new AppError('not_found', 'Snapshot not found')
      res.json({ snapshot: { id: d.id, ...d.data(), createdAt: ts(d.data()!.createdAt) } })
    }),
  )

  r.post(
    '/projects/:pid/snapshots',
    handler(async (req, res) => {
      await getProjectOrThrow(req.uid, req.params.pid)
      const label = z.object({ label: z.string().trim().min(1).max(80) }).parse(req.body).label
      const files = await readFiles(req.uid, req.params.pid)
      const batch = db().batch()
      const id = stageSnapshot(batch, req.uid, req.params.pid, files, { reason: 'manual', label })
      await batch.commit()
      res.status(201).json({ snapshotId: id })
    }),
  )

  r.post(
    '/projects/:pid/snapshots/:sid/restore',
    handler(async (req, res) => {
      const project = await getProjectOrThrow(req.uid, req.params.pid)
      if (((project.generationLock as { until: number } | undefined)?.until ?? 0) > Date.now()) {
        throw new AppError('conflict', 'Cannot restore while a generation is running')
      }
      res.json(await restoreSnapshot(req.uid, req.params.pid, req.params.sid))
    }),
  )

  // ---------- Chat / generations ----------
  r.get(
    '/projects/:pid/messages',
    handler(async (req, res) => {
      await getProjectOrThrow(req.uid, req.params.pid)
      const snap = await paths.messages(req.uid, req.params.pid).orderBy('createdAt', 'asc').limitToLast(200).get()
      res.json({ messages: snap.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: ts(d.data().createdAt) })) })
    }),
  )

  r.get(
    '/projects/:pid/generations/:gid',
    handler(async (req, res) => {
      await getProjectOrThrow(req.uid, req.params.pid)
      const d = await paths.generations(req.uid, req.params.pid).doc(req.params.gid).get()
      if (!d.exists) throw new AppError('not_found', 'Generation not found')
      const x = d.data()!
      res.json({
        generation: {
          id: d.id,
          prompt: x.prompt,
          status: x.status,
          summary: x.summary ?? null,
          changes: x.changes ?? [],
          diff: x.diff ?? null,
          snapshotId: x.snapshotId ?? null,
          error: x.error ?? null,
          partialFile: x.partialFile ?? null,
          createdAt: ts(x.createdAt),
          finishedAt: ts(x.finishedAt),
        },
      })
    }),
  )

  r.post(
    '/projects/:pid/generate',
    handler(async (req, res) => {
      await streamGeneration(req.uid, req.params.pid, req, res)
    }),
  )

  r.post(
    '/projects/:pid/generations/:gid/cancel',
    handler(async (req, res) => {
      res.json(await requestCancel(req.uid, req.params.pid, req.params.gid))
    }),
  )

  return r
}
