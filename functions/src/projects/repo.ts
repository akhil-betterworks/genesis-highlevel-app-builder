import { FieldValue, type WriteBatch } from 'firebase-admin/firestore'
import { db, fileId, paths } from '../lib/firestore'
import { AppError } from '../lib/errors'
import { languageFor, type FileChange, type ProjectFile } from '../generation/files'

export interface ProjectDoc {
  id: string
  name: string
  description?: string
  [key: string]: unknown
}

export async function getProjectOrThrow(uid: string, pid: string): Promise<ProjectDoc> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(pid)) throw new AppError('not_found', 'Project not found')
  const snap = await paths.project(uid, pid).get()
  if (!snap.exists || snap.data()?.deletedAt) throw new AppError('not_found', 'Project not found')
  const data = snap.data() as Omit<ProjectDoc, 'id'>
  return { ...data, id: snap.id, name: String(data.name ?? '') }
}

export async function readFiles(uid: string, pid: string): Promise<ProjectFile[]> {
  const snap = await paths.files(uid, pid).get()
  return snap.docs
    .map((d) => ({ path: d.data().path as string, content: d.data().content as string }))
    .sort((a, b) => a.path.localeCompare(b.path))
}

/** Replace the project's working tree with `files` inside the given batch. */
export async function stageReplaceFiles(
  batch: WriteBatch,
  uid: string,
  pid: string,
  files: ProjectFile[],
  source: 'ai' | 'user' | 'restore',
) {
  const existing = await paths.files(uid, pid).get()
  const keep = new Set(files.map((f) => fileId(f.path)))
  for (const doc of existing.docs) if (!keep.has(doc.id)) batch.delete(doc.ref)
  const byId = new Map(existing.docs.map((d) => [d.id, d.data().content as string]))
  for (const f of files) {
    const id = fileId(f.path)
    if (byId.get(id) === f.content) continue
    batch.set(paths.files(uid, pid).doc(id), {
      path: f.path,
      content: f.content,
      language: languageFor(f.path),
      size: Buffer.byteLength(f.content, 'utf8'),
      updatedBy: source,
      updatedAt: FieldValue.serverTimestamp(),
    })
  }
}

export function stageSnapshot(
  batch: WriteBatch,
  uid: string,
  pid: string,
  files: ProjectFile[],
  meta: { reason: 'initial' | 'generation' | 'restore' | 'pre-restore' | 'manual'; label: string; generationId?: string; restoredFrom?: string },
) {
  const ref = paths.snapshots(uid, pid).doc()
  batch.set(ref, {
    ...meta,
    files,
    fileCount: files.length,
    bytes: files.reduce((n, f) => n + Buffer.byteLength(f.content, 'utf8'), 0),
    createdAt: FieldValue.serverTimestamp(),
  })
  return ref.id
}

export async function restoreSnapshot(uid: string, pid: string, snapshotId: string) {
  await getProjectOrThrow(uid, pid)
  const snap = await paths.snapshots(uid, pid).doc(snapshotId).get()
  if (!snap.exists) throw new AppError('not_found', 'Snapshot not found')
  const target = (snap.data()!.files as ProjectFile[]) ?? []
  const current = await readFiles(uid, pid)

  const batch = db().batch()
  // Non-destructive: preserve the current tree (incl. manual edits) before reverting.
  stageSnapshot(batch, uid, pid, current, { reason: 'pre-restore', label: 'Auto-backup before restore' })
  await stageReplaceFiles(batch, uid, pid, target, 'restore')
  const newId = stageSnapshot(batch, uid, pid, target, {
    reason: 'restore',
    label: `Restored "${snap.data()!.label ?? snapshotId}"`,
    restoredFrom: snapshotId,
  })
  batch.update(paths.project(uid, pid), {
    fileCount: target.length,
    currentSnapshotId: newId,
    updatedAt: FieldValue.serverTimestamp(),
  })
  await batch.commit()
  return { snapshotId: newId, files: target }
}

export function diffFiles(before: ProjectFile[], after: ProjectFile[]): FileChange[] {
  const b = new Map(before.map((f) => [f.path, f.content]))
  const a = new Map(after.map((f) => [f.path, f.content]))
  const out: FileChange[] = []
  for (const [path, content] of a) {
    const prev = b.get(path)
    if (prev === undefined) out.push({ path, type: 'added', before: null, after: content })
    else if (prev !== content) out.push({ path, type: 'modified', before: prev, after: content })
  }
  for (const [path, content] of b) if (!a.has(path)) out.push({ path, type: 'deleted', before: content, after: null })
  return out
}
