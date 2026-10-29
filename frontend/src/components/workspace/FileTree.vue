<script setup lang="ts">
import { computed } from 'vue'
import { FileCode, FileJson, FileText, FileType, Folder, Loader2, Palette } from 'lucide-vue-next'
import type { Workspace } from '@/composables/useWorkspace'

const props = defineProps<{ ws: Workspace }>()

interface Node {
  name: string
  path: string
  depth: number
  dir: boolean
}

/** Flattened tree (folders first) — simple, keyboard friendly and cheap to render. */
const nodes = computed<Node[]>(() => {
  const out: Node[] = []
  const seenDirs = new Set<string>()
  const paths = [...props.ws.sortedPaths].sort((a, b) => {
    const da = a.includes('/') ? 0 : 1
    const db = b.includes('/') ? 0 : 1
    return da - db || a.localeCompare(b)
  })
  for (const p of paths) {
    const parts = p.split('/')
    for (let i = 0; i < parts.length - 1; i++) {
      const dir = parts.slice(0, i + 1).join('/')
      if (!seenDirs.has(dir)) {
        seenDirs.add(dir)
        out.push({ name: parts[i], path: dir, depth: i, dir: true })
      }
    }
    out.push({ name: parts[parts.length - 1], path: p, depth: parts.length - 1, dir: false })
  }
  return out
})

function icon(path: string) {
  if (path.endsWith('.js')) return FileCode
  if (path.endsWith('.json')) return FileJson
  if (path.endsWith('.css')) return Palette
  if (path.endsWith('.html')) return FileType
  return FileText
}

const changed = computed(() => new Map(props.ws.lastChanges.map((c) => [c.path, c.type])))
</script>

<template>
  <div class="scrollbar-thin h-full overflow-y-auto py-2 text-sm">
    <p class="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Files</p>
    <p v-if="!nodes.length" class="px-3 text-xs text-muted-foreground">No files yet.</p>
    <template v-for="n in nodes" :key="n.path">
      <div v-if="n.dir" class="flex items-center gap-1.5 px-3 py-1 text-muted-foreground" :style="{ paddingLeft: `${12 + n.depth * 12}px` }">
        <Folder class="size-3.5" /> {{ n.name }}
      </div>
      <button
        v-else
        :class="[
          'group flex w-full items-center gap-1.5 px-3 py-1 text-left transition-colors',
          ws.active === n.path ? 'bg-indigo-500/15 text-foreground' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
        ]"
        :style="{ paddingLeft: `${12 + n.depth * 12}px` }"
        @click="ws.openFile(n.path)"
      >
        <Loader2 v-if="ws.files.get(n.path)?.streaming" class="size-3.5 animate-spin text-indigo-300" />
        <component :is="icon(n.path)" v-else class="size-3.5" />
        <span class="truncate">{{ n.name }}</span>
        <span v-if="ws.dirty.includes(n.path)" class="ml-auto size-1.5 rounded-full bg-amber-400" title="Unsaved changes" />
        <span
          v-else-if="changed.get(n.path)"
          :class="['ml-auto text-[10px] font-semibold', changed.get(n.path) === 'added' ? 'text-emerald-400' : 'text-amber-400']"
        >
          {{ changed.get(n.path) === 'added' ? 'A' : 'M' }}
        </span>
      </button>
    </template>
  </div>
</template>
