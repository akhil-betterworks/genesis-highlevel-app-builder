<script setup lang="ts">
import { ref, watch } from 'vue'
import { toast } from 'vue-sonner'
import { Bookmark, History, Loader2, RotateCcw, Sparkles, Undo2, Flag, Save } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Input from '@/components/ui/input/Input.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { api } from '@/lib/api'
import type { Snapshot } from '@/lib/types'
import { formatBytes, timeAgo } from '@/lib/utils'
import type { Workspace } from '@/composables/useWorkspace'

const open = defineModel<boolean>('open', { required: true })
const props = defineProps<{ ws: Workspace }>()

const snapshots = ref<Snapshot[]>([])
const loading = ref(false)
const restoring = ref<string | null>(null)
const label = ref('')
const saving = ref(false)

async function load() {
  loading.value = true
  try {
    snapshots.value = (await api.listSnapshots(props.ws.projectId)).snapshots
  } catch (e) {
    toast.error('Could not load history', { description: (e as Error).message })
  } finally {
    loading.value = false
  }
}

watch(open, (v) => v && load())

async function restore(s: Snapshot) {
  restoring.value = s.id
  try {
    await api.restoreSnapshot(props.ws.projectId, s.id)
    await props.ws.afterRestore()
    toast.success('Snapshot restored', { description: 'Your previous state was auto-saved as a backup snapshot.' })
    await load()
  } catch (e) {
    toast.error('Restore failed', { description: (e as Error).message })
  } finally {
    restoring.value = null
  }
}

async function checkpoint() {
  if (!label.value.trim()) return
  saving.value = true
  try {
    if (props.ws.dirty.length) await props.ws.saveAll()
    await api.createSnapshot(props.ws.projectId, label.value.trim())
    label.value = ''
    await load()
  } catch (e) {
    toast.error('Could not create checkpoint', { description: (e as Error).message })
  } finally {
    saving.value = false
  }
}

const meta = {
  initial: { icon: Flag, label: 'Created', variant: 'secondary' },
  generation: { icon: Sparkles, label: 'AI', variant: 'info' },
  restore: { icon: RotateCcw, label: 'Restore', variant: 'success' },
  'pre-restore': { icon: Undo2, label: 'Backup', variant: 'warning' },
  manual: { icon: Bookmark, label: 'Checkpoint', variant: 'outline' },
} as const
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="sm:max-w-lg">
      <SheetHeader>
        <SheetTitle class="flex items-center gap-2"><History class="size-5" /> Version history</SheetTitle>
        <SheetDescription>Every generation creates a snapshot. Restoring is non-destructive — the current state is backed up first.</SheetDescription>
      </SheetHeader>

      <form class="flex gap-2" @submit.prevent="checkpoint">
        <Input v-model="label" maxlength="80" placeholder="Name a checkpoint (e.g. before redesign)" />
        <Button type="submit" variant="secondary" :disabled="!label.trim() || saving || ws.isStreaming">
          <Loader2 v-if="saving" class="animate-spin" /><Save v-else /> Save
        </Button>
      </form>

      <div class="scrollbar-thin -mx-6 flex-1 overflow-y-auto px-6">
        <div v-if="loading && !snapshots.length" class="space-y-3">
          <Skeleton v-for="i in 4" :key="i" class="h-16" />
        </div>
        <ol v-else class="relative space-y-3 border-l border-white/10 pl-5">
          <li v-for="(s, i) in snapshots" :key="s.id" class="relative">
            <span
              :class="[
                'absolute -left-[27px] top-3 grid size-3.5 place-items-center rounded-full border-2 border-background',
                i === 0 ? 'bg-indigo-400' : 'bg-muted-foreground/50',
              ]"
            />
            <div class="rounded-lg border bg-background/40 p-3 transition hover:border-white/20">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <Badge :variant="meta[s.reason]?.variant ?? 'outline'">
                      <component :is="meta[s.reason]?.icon ?? Bookmark" /> {{ meta[s.reason]?.label ?? s.reason }}
                    </Badge>
                    <Badge v-if="i === 0" variant="success">Current</Badge>
                  </div>
                  <p class="mt-1.5 truncate text-sm font-medium" :title="s.label">{{ s.label }}</p>
                  <p class="mt-0.5 text-xs text-muted-foreground">
                    {{ s.createdAt ? new Date(s.createdAt).toLocaleString() : '—' }} · {{ timeAgo(s.createdAt) }} · {{ s.fileCount }} files ·
                    {{ formatBytes(s.bytes ?? 0) }}
                  </p>
                </div>
                <Button
                  v-if="i !== 0"
                  size="sm"
                  variant="outline"
                  :disabled="!!restoring || ws.isStreaming"
                  @click="restore(s)"
                >
                  <Loader2 v-if="restoring === s.id" class="animate-spin" /><RotateCcw v-else /> Restore
                </Button>
              </div>
            </div>
          </li>
        </ol>
      </div>
    </SheetContent>
  </Sheet>
</template>
