<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueMonacoEditor } from '@guolao/vue-monaco-editor'
import { Lock, Save, X, Code2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import type { Workspace } from '@/composables/useWorkspace'

const props = defineProps<{ ws: Workspace }>()

const file = computed(() => (props.ws.active ? props.ws.files.get(props.ws.active) : undefined))
const readOnly = computed(() => props.ws.isStreaming)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const editorRef = ref<any>(null)

const options = computed(() => ({
  readOnly: readOnly.value,
  minimap: { enabled: false },
  fontSize: 13,
  fontFamily: 'JetBrains Mono, ui-monospace, Menlo, monospace',
  fontLigatures: true,
  smoothScrolling: true,
  scrollBeyondLastLine: false,
  automaticLayout: true,
  tabSize: 2,
  wordWrap: 'on' as const,
  padding: { top: 12 },
  renderLineHighlight: 'gutter' as const,
}))

const value = computed({
  get: () => file.value?.content ?? '',
  set: (v: string) => {
    if (file.value && !readOnly.value) file.value.content = v
  },
})

// Follow the stream: keep the cursor at the end of the file being written.
watch(
  () => file.value?.streaming && file.value.content.length,
  () => {
    const ed = editorRef.value
    if (ed && file.value?.streaming) {
      const model = ed.getModel?.()
      if (model) ed.revealLine(model.getLineCount())
    }
  },
)

function onMount(editor: unknown, monaco: { KeyMod: { CtrlCmd: number }; KeyCode: { KeyS: number } }) {
  editorRef.value = editor
  ;(editor as { addCommand: (k: number, fn: () => void) => void }).addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    void props.ws.save()
  })
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="scrollbar-thin flex h-10 shrink-0 items-stretch overflow-x-auto border-b border-white/5 bg-background/40">
      <div
        v-for="p in ws.openTabs"
        :key="p"
        :class="[
          'group flex cursor-pointer items-center gap-2 border-r border-white/5 px-3 text-xs transition-colors',
          ws.active === p ? 'bg-card text-foreground shadow-[inset_0_-2px_0_hsl(var(--primary))]' : 'text-muted-foreground hover:bg-accent/50',
        ]"
        @click="ws.openFile(p)"
      >
        <span class="font-mono">{{ p }}</span>
        <span v-if="ws.dirty.includes(p)" class="size-1.5 rounded-full bg-amber-400" />
        <button class="rounded p-0.5 opacity-0 hover:bg-accent group-hover:opacity-100" aria-label="Close tab" @click.stop="ws.closeTab(p)">
          <X class="size-3" />
        </button>
      </div>
      <div class="ml-auto flex items-center gap-2 px-2">
        <span v-if="readOnly" class="flex items-center gap-1 text-xs text-amber-300"><Lock class="size-3" /> Read-only while generating</span>
        <Button v-else-if="file && ws.dirty.includes(file.path)" size="xs" variant="secondary" @click="ws.save()">
          <Save class="size-3" /> Save <kbd class="ml-1 text-[10px] opacity-60">⌘S</kbd>
        </Button>
      </div>
    </div>

    <div class="relative min-h-0 flex-1">
      <VueMonacoEditor
        v-if="file"
        v-model:value="value"
        :path="file.path"
        :language="file.language"
        theme="vs-dark"
        :options="options"
        @mount="onMount"
      >
        <template #default>
          <div class="grid h-full place-items-center text-xs text-muted-foreground">Loading editor…</div>
        </template>
      </VueMonacoEditor>
      <div v-else class="grid h-full place-items-center text-center text-sm text-muted-foreground">
        <div>
          <Code2 class="mx-auto size-8 opacity-40" />
          <p class="mt-2">Generated code appears here in real time.</p>
        </div>
      </div>
    </div>
  </div>
</template>
