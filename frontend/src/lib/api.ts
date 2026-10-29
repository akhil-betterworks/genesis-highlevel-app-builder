import { auth } from './firebase'
import type { Generation, HlStatus, Message, Project, ProjectFile, Snapshot, SnapshotDetail } from './types'

export const API_BASE = (import.meta.env.VITE_API_BASE || '/api').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message)
  }
}

export async function authHeader(): Promise<Record<string, string>> {
  const user = auth.currentUser
  if (!user) throw new ApiError(401, 'unauthenticated', 'Please sign in again')
  try {
    return { Authorization: `Bearer ${await user.getIdToken()}` }
  } catch (e) {
    // Refresh token revoked/expired or user deleted (e.g. emulator reset): drop the dead session
    // so the user is sent to /login instead of looping on failed calls.
    await auth.signOut().catch(() => undefined)
    if (!location.pathname.startsWith('/login')) location.assign('/login')
    throw new ApiError(401, 'unauthenticated', 'Your session expired. Please sign in again.')
  }
}

async function request<T>(method: string, path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: { ...(await authHeader()), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'network', 'Network error — is the API running?')
  }
  const text = await res.text()
  const data = text ? safeJson(text) : null
  if (!res.ok) {
    const err = (data as { error?: { code: string; message: string; details?: unknown } } | null)?.error
    throw new ApiError(res.status, err?.code ?? 'http_error', err?.message ?? `Request failed (${res.status})`, err?.details)
  }
  return data as T
}

function safeJson(t: string): unknown {
  try {
    return JSON.parse(t)
  } catch {
    return t
  }
}

const q = (p: string) => encodeURIComponent(p)

export const api = {
  me: () => request<{ uid: string; email: string | null; hl: HlStatus }>('GET', '/me'),

  // HighLevel
  hlStatus: () => request<HlStatus>('GET', '/hl/status'),
  hlStart: (returnTo: string) => request<{ url: string }>('POST', '/hl/oauth/start', { returnTo }),
  hlDisconnect: () => request<{ ok: true }>('DELETE', '/hl/connection'),
  hlProxy: (req: { method: string; path: string; query?: unknown; body?: unknown }) =>
    request<{ status: number; data: unknown }>('POST', '/hl/proxy', req),

  // Projects
  listProjects: () => request<{ projects: Project[] }>('GET', '/projects'),
  createProject: (input: { name: string; description?: string }) => request<{ project: Project }>('POST', '/projects', input),
  getProject: (id: string) => request<{ project: Project }>('GET', `/projects/${id}`),
  updateProject: (id: string, patch: Partial<Pick<Project, 'name' | 'description'>> & { relinkLocation?: boolean }) =>
    request<{ project: Project }>('PATCH', `/projects/${id}`, patch),
  deleteProject: (id: string) => request<{ ok: true }>('DELETE', `/projects/${id}`),

  // Files
  listFiles: (id: string, content = true) =>
    request<{ files: ProjectFile[] }>('GET', `/projects/${id}/files${content ? '?content=1' : ''}`),
  readFile: (id: string, path: string) => request<{ file: ProjectFile }>('GET', `/projects/${id}/file?path=${q(path)}`),
  saveFile: (id: string, path: string, content: string) => request<{ ok: true }>('PUT', `/projects/${id}/file`, { path, content }),
  deleteFile: (id: string, path: string) => request<{ ok: true }>('DELETE', `/projects/${id}/file?path=${q(path)}`),

  // Snapshots
  listSnapshots: (id: string) => request<{ snapshots: Snapshot[] }>('GET', `/projects/${id}/snapshots`),
  getSnapshot: (id: string, sid: string) => request<{ snapshot: SnapshotDetail }>('GET', `/projects/${id}/snapshots/${sid}`),
  createSnapshot: (id: string, label: string) => request<{ snapshotId: string }>('POST', `/projects/${id}/snapshots`, { label }),
  restoreSnapshot: (id: string, sid: string) =>
    request<{ snapshotId: string; files: { path: string; content: string }[] }>('POST', `/projects/${id}/snapshots/${sid}/restore`),

  // Chat / generation
  listMessages: (id: string) => request<{ messages: Message[] }>('GET', `/projects/${id}/messages`),
  getGeneration: (id: string, gid: string) => request<{ generation: Generation }>('GET', `/projects/${id}/generations/${gid}`),
  cancelGeneration: (id: string, gid: string) => request<{ ok: true }>('POST', `/projects/${id}/generations/${gid}/cancel`),
}
