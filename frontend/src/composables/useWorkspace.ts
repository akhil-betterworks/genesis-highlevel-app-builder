import { computed, reactive, ref, shallowRef } from 'vue'
import { toast } from 'vue-sonner'
import { api, ApiError } from '@/lib/api'
import { streamSse, type SseMessage } from '@/lib/sse'
import type { FileChangeRef, Message, Project } from '@/lib/types'

export interface WsFile {
  path: string
  content: string
  saved: string
  language: string
  streaming?: boolean
}

export type Stage = 'idle' | 'context' | 'generating' | 'applying' | 'reconciling'

const LANG: Record<string, string> = {
  html: 'html',
  css: 'css',
  js: 'javascript',
  json: 'json',
  md: 'markdown',
  svg: 'xml',
  txt: 'plaintext',
}
export const languageFor = (p: string) => LANG[p.split('.').pop() ?? ''] ?? 'plaintext'

/** Single source of truth for one open project workspace. */
export function createWorkspace(projectId: string) {
  const project = ref<Project | null>(null)
  const files = reactive(new Map<string, WsFile>())
  const openTabs = ref<string[]>([])
  const active = ref<string | null>(null)
  const messages = ref<Message[]>([])
  const loading = ref(true)
  const loadError = ref<string | null>(null)

  const stage = ref<Stage>('idle')
  const stageMessage = ref('')
  const streamingPath = ref<string | null>(null)
  const generationId = ref<string | null>(null)
  const lastChanges = ref<FileChangeRef[]>([])
  const lastGenerationId = ref<string | null>(null)
  const previewVersion = ref(0)
  const controller = shallowRef<AbortController | null>(null)

  const isStreaming = computed(() => stage.value !== 'idle')
  const sortedPaths = computed(() => [...files.keys()].sort())
  const dirty = computed(() =>
    stage.value !== 'idle' ? [] : [...files.values()].filter((f) => f.content !== f.saved).map((f) => f.path),
  )
  const previewFiles = computed(() => [...files.values()].map((f) => ({ path: f.path, content: f.saved })))

  function upsert(path: string, content: string, saved = content) {
    const existing = files.get(path)
    if (existing) {
      existing.content = content
      existing.saved = saved
    } else {
      files.set(path, { path, content, saved, language: languageFor(path) })
    }
  }

  function openFile(path: string) {
    if (!files.has(path)) return
    if (!openTabs.value.includes(path)) openTabs.value.push(path)
    active.value = path
  }

  function closeTab(path: string) {
    const i = openTabs.value.indexOf(path)
    if (i === -1) return
    openTabs.value.splice(i, 1)
    if (active.value === path) active.value = openTabs.value[Math.max(0, i - 1)] ?? null
  }

  async function loadFiles() {
    const { files: list } = await api.listFiles(projectId, true)
    const seen = new Set<string>()
    for (const f of list) {
      seen.add(f.path)
      const cur = files.get(f.path)
      // Preserve unsaved local edits when the server copy hasn't changed underneath them.
      if (cur && cur.content !== cur.saved && cur.saved === f.content) continue
      upsert(f.path, f.content ?? '')
    }
    for (const p of [...files.keys()]) if (!seen.has(p)) files.delete(p)
    openTabs.value = openTabs.value.filter((p) => files.has(p))
    if (active.value && !files.has(active.value)) active.value = openTabs.value[0] ?? null
    if (!active.value) {
      const first = ['main.js', 'index.html'].find((p) => files.has(p)) ?? sortedPaths.value[0]
      if (first) openFile(first)
    }
  }

  async function loadMessages() {
    messages.value = (await api.listMessages(projectId)).messages
  }

  async function load() {
    loading.value = true
    loadError.value = null
    try {
      const [{ project: p }] = await Promise.all([api.getProject(projectId), loadFiles(), loadMessages()])
      project.value = p
      previewVersion.value++
    } catch (e) {
      loadError.value = (e as Error).message
    } finally {
      loading.value = false
    }
  }

  async function save(path = active.value) {
    if (!path) return
    const f = files.get(path)
    if (!f || f.content === f.saved) return
    const content = f.content
    try {
      await api.saveFile(projectId, path, content)
      f.saved = content
      previewVersion.value++
      toast.success(`Saved ${path}`)
    } catch (e) {
      toast.error(`Could not save ${path}`, { description: (e as Error).message })
    }
  }

  async function saveAll() {
    for (const p of dirty.value) await save(p)
  }

  // ---------------- Generation ----------------
  // Streams emit hundreds of tiny deltas. Applying each one re-renders Monaco (full setValue) and
  // freezes the tab, so deltas are buffered and flushed at most every ~120ms.
  const pendingDeltas = new Map<string, string>()
  let flushTimer: ReturnType<typeof setTimeout> | null = null
  function flushDeltas() {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = null
    for (const [path, text] of pendingDeltas) {
      const f = files.get(path)
      if (f) f.content += text
    }
    pendingDeltas.clear()
  }
  function queueDelta(path: string, text: string) {
    pendingDeltas.set(path, (pendingDeltas.get(path) ?? '') + text)
    flushTimer ??= setTimeout(flushDeltas, 120)
  }

  function handleEvent(m: SseMessage, assistant: Message) {
    const d = m.data as Record<string, unknown>
    if (m.event !== 'file_delta' && pendingDeltas.size) flushDeltas()
    switch (m.event) {
      case 'meta':
        generationId.value = String(d.generationId)
        assistant.generationId = generationId.value
        break
      case 'status':
        stage.value = d.stage as Stage
        stageMessage.value = String(d.message ?? '')
        break
      case 'token':
        break
      case 'file_start': {
        const path = String(d.path)
        const prev = files.get(path)
        if (prev) {
          prev.content = ''
          prev.streaming = true
        } else {
          files.set(path, { path, content: '', saved: '', language: languageFor(path), streaming: true })
        }
        streamingPath.value = path
        openFile(path)
        break
      }
      case 'file_delta':
        queueDelta(String(d.path), String(d.text))
        break
      case 'file_end': {
        const f = files.get(String(d.path))
        if (f) f.streaming = false
        streamingPath.value = null
        break
      }
      case 'file_delete':
        closeTab(String(d.path))
        files.delete(String(d.path))
        break
      case 'error':
        assistant.status = d.partial ? 'partial' : 'failed'
        toast.error(String(d.message ?? 'Generation failed'), {
          description: d.partial ? 'Completed files were kept and snapshotted.' : undefined,
        })
        break
      case 'done':
        assistant.content = String(d.summary ?? 'Done')
        assistant.status = d.status as Message['status']
        assistant.changes = (d.changes as FileChangeRef[]) ?? []
        assistant.pending = false
        lastChanges.value = assistant.changes
        lastGenerationId.value = String(d.generationId)
        if (d.warning) toast.warning(String(d.warning))
        break
    }
  }

  async function reconcile(gid: string | null) {
    stage.value = 'reconciling'
    stageMessage.value = 'Connection lost — recovering saved results…'
    if (gid) {
      for (let i = 0; i < 30; i++) {
        try {
          const { generation } = await api.getGeneration(projectId, gid)
          if (generation.status !== 'streaming') {
            lastChanges.value = generation.changes
            lastGenerationId.value = generation.id
            break
          }
        } catch {
          /* keep polling */
        }
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
  }

  async function generate(prompt: string) {
    if (isStreaming.value) return
    if (dirty.value.length) await saveAll()
    const ctrl = new AbortController()
    controller.value = ctrl
    stage.value = 'context'
    stageMessage.value = 'Starting…'
    generationId.value = null
    const userMsg: Message = { id: `local-${Date.now()}`, role: 'user', content: prompt, createdAt: Date.now() }
    const assistant = reactive<Message>({
      id: `local-a-${Date.now()}`,
      role: 'assistant',
      content: '',
      createdAt: Date.now(),
      pending: true,
    })
    messages.value.push(userMsg, assistant)

    let completed = false
    try {
      const res = await streamSse(`/projects/${projectId}/generate`, { prompt }, (m) => handleEvent(m, assistant), ctrl.signal)
      completed = res.completed
      if (!completed) await reconcile(generationId.value)
    } catch (e) {
      if ((e as Error).name === 'AbortError') {
        await reconcile(generationId.value)
      } else {
        const err = e as ApiError
        assistant.pending = false
        assistant.status = 'failed'
        assistant.content = err.message
        toast.error(err.code === 'conflict' ? 'A generation is already running' : 'Generation failed', { description: err.message })
      }
    } finally {
      flushDeltas()
      controller.value = null
      streamingPath.value = null
      for (const f of files.values()) f.streaming = false
      // Server state is the source of truth after any generation (complete, partial or cancelled).
      await Promise.allSettled([loadFiles(), loadMessages(), api.getProject(projectId).then((r) => (project.value = r.project))])
      previewVersion.value++
      stage.value = 'idle'
      stageMessage.value = ''
    }
  }

  async function cancel() {
    const gid = generationId.value
    if (gid) await api.cancelGeneration(projectId, gid).catch(() => undefined)
    // Give the server a moment to persist the partial result before we drop the connection.
    setTimeout(() => controller.value?.abort(), 1500)
  }

  async function afterRestore() {
    await Promise.all([loadFiles(), loadMessages()])
    previewVersion.value++
  }

  return reactive({
    projectId,
    project,
    files,
    openTabs,
    active,
    messages,
    loading,
    loadError,
    stage,
    stageMessage,
    streamingPath,
    lastChanges,
    lastGenerationId,
    previewVersion,
    isStreaming,
    sortedPaths,
    dirty,
    previewFiles,
    load,
    openFile,
    closeTab,
    save,
    saveAll,
    generate,
    cancel,
    afterRestore,
    reloadFiles: loadFiles,
  })
}

export type Workspace = ReturnType<typeof createWorkspace>
