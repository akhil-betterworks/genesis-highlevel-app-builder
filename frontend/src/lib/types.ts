export interface HlStatus {
  connected: boolean
  locationId?: string
  locationName?: string | null
  needsReauth?: boolean
  scope?: string | null
}

export interface Project {
  id: string
  name: string
  description: string
  hlLocationId: string | null
  hlLocationName: string | null
  fileCount: number
  currentSnapshotId: string | null
  generating: boolean
  createdAt: number | null
  updatedAt: number | null
}

export interface ProjectFile {
  path: string
  content?: string
  language?: string
  size?: number
  updatedBy?: 'ai' | 'user' | 'restore'
  updatedAt?: number | null
}

export interface Snapshot {
  id: string
  label: string
  reason: 'initial' | 'generation' | 'restore' | 'pre-restore' | 'manual'
  fileCount: number
  bytes: number
  generationId?: string
  restoredFrom?: string
  createdAt: number | null
}

export interface SnapshotDetail extends Snapshot {
  files: { path: string; content: string }[]
}

export interface FileChangeRef {
  path: string
  type: 'added' | 'modified' | 'deleted'
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  generationId?: string
  status?: GenerationStatus
  changes?: FileChangeRef[]
  createdAt: number | null
  /** client-only */
  pending?: boolean
}

export type GenerationStatus = 'streaming' | 'completed' | 'partial' | 'failed' | 'cancelled'

export interface Generation {
  id: string
  prompt: string
  status: GenerationStatus
  summary: string | null
  changes: FileChangeRef[]
  diff: { path: string; type: FileChangeRef['type']; before: string | null; after: string | null }[] | null
  snapshotId: string | null
  error: { code: string; message: string } | null
  partialFile: { path: string; content: string } | null
  createdAt: number | null
  finishedAt: number | null
}
