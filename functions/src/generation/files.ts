import { LIMITS } from '../config'
import { AppError } from '../lib/errors'

const PATH_RE = /^(?!\/)(?!.*\.\.)(?!.*\/\/)[A-Za-z0-9_\-./]{1,120}$/
const ALLOWED_EXT = /\.(html|css|js|json|md|svg|txt)$/

export interface ProjectFile {
  path: string
  content: string
}

export function validatePath(path: string): string {
  const p = path.trim().replace(/^\.\//, '')
  if (!PATH_RE.test(p) || !ALLOWED_EXT.test(p)) {
    throw new AppError('invalid_argument', `Invalid file path: ${path}`)
  }
  return p
}

export function validateFileContent(path: string, content: string) {
  if (Buffer.byteLength(content, 'utf8') > LIMITS.maxFileBytes) {
    throw new AppError('payload_too_large', `File ${path} exceeds ${LIMITS.maxFileBytes} bytes`)
  }
}

export function validateProject(files: ProjectFile[]) {
  if (files.length > LIMITS.maxFiles) throw new AppError('payload_too_large', `Too many files (max ${LIMITS.maxFiles})`)
  const total = files.reduce((n, f) => n + Buffer.byteLength(f.content, 'utf8'), 0)
  if (total > LIMITS.maxProjectBytes) throw new AppError('payload_too_large', 'Project exceeds size limit')
}

export function languageFor(path: string): string {
  const ext = path.split('.').pop() ?? ''
  return (
    { html: 'html', css: 'css', js: 'javascript', json: 'json', md: 'markdown', svg: 'xml', txt: 'plaintext' } as Record<
      string,
      string
    >
  )[ext] ?? 'plaintext'
}

export type FileOp =
  | { op: 'write'; path: string; content: string }
  | { op: 'delete'; path: string }

export interface FileChange {
  path: string
  type: 'added' | 'modified' | 'deleted'
  before: string | null
  after: string | null
}

/** Pure: apply operations to a file set, returning the new set and a per-file diff summary. */
export function applyOps(current: ProjectFile[], ops: FileOp[]): { files: ProjectFile[]; changes: FileChange[] } {
  const map = new Map(current.map((f) => [f.path, f.content]))
  const changes = new Map<string, FileChange>()
  for (const op of ops) {
    const path = validatePath(op.path)
    const before = map.get(path) ?? null
    const prior = changes.get(path)
    const original = prior ? prior.before : before
    if (op.op === 'delete') {
      if (before === null) continue
      map.delete(path)
      if (original === null) changes.delete(path)
      else changes.set(path, { path, type: 'deleted', before: original, after: null })
    } else {
      validateFileContent(path, op.content)
      map.set(path, op.content)
      if (original === op.content) changes.delete(path)
      else changes.set(path, { path, type: original === null ? 'added' : 'modified', before: original, after: op.content })
    }
  }
  const files = [...map.entries()].map(([path, content]) => ({ path, content })).sort((a, b) => a.path.localeCompare(b.path))
  validateProject(files)
  return { files, changes: [...changes.values()] }
}
