<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { VueMonacoDiffEditor } from '@guolao/vue-monaco-editor'
import { FileDiff, Loader2 } from 'lucide-vue-next'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import type { Generation } from '@/lib/types'
import { languageFor } from '@/composables/useWorkspace'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ projectId: string; generationId: string | null }>()

const gen = ref<Generation | null>(null)
const loading = ref(false)
const error = ref('')
const selected = ref<string | null>(null)

watch(
  () => [open.value, props.generationId],
  async () => {
    if (!open.value || !props.generationId) return
    loading.value = true
    error.value = ''
    try {
      const g = (await api.getGeneration(props.projectId, props.generationId)).generation
      gen.value = g
      selected.value = g.diff?.[0]?.path ?? null
    } catch (e) {
      error.value = (e as Error).message
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

const current = computed(() => gen.value?.diff?.find((d) => d.path === selected.value))
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex h-[85vh] max-w-6xl flex-col gap-3">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2"><FileDiff class="size-5" /> What Genesis changed</DialogTitle>
        <DialogDescription class="line-clamp-1">{{ gen?.prompt }}</DialogDescription>
      </DialogHeader>
      <div v-if="loading" class="grid flex-1 place-items-center"><Loader2 class="size-6 animate-spin text-muted-foreground" /></div>
      <p v-else-if="error" class="text-sm text-red-400">{{ error }}</p>
      <p v-else-if="!gen?.diff?.length" class="text-sm text-muted-foreground">No diff stored for this generation.</p>
      <div v-else class="flex min-h-0 flex-1 gap-3">
        <div class="scrollbar-thin w-56 shrink-0 space-y-1 overflow-y-auto">
          <button
            v-for="d in gen.diff"
            :key="d.path"
            :class="['flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs', selected === d.path ? 'bg-accent' : 'hover:bg-accent/50']"
            @click="selected = d.path"
          >
            <Badge :variant="d.type === 'added' ? 'success' : d.type === 'deleted' ? 'destructive' : 'warning'" class="px-1">
              {{ d.type[0].toUpperCase() }}
            </Badge>
            <span class="truncate font-mono">{{ d.path }}</span>
          </button>
        </div>
        <div class="min-h-0 flex-1 overflow-hidden rounded-lg border">
          <VueMonacoDiffEditor
            v-if="current"
            :original="current.before ?? ''"
            :modified="current.after ?? ''"
            :language="languageFor(current.path)"
            theme="vs-dark"
            :options="{ readOnly: true, renderSideBySide: true, minimap: { enabled: false }, automaticLayout: true, fontSize: 12 }"
          />
        </div>
      </div>
    </DialogContent>
  </Dialog>
</template>
