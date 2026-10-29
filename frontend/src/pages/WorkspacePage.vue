<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'
import { ArrowLeft, History, Link2, Loader2, Save } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import AppLogo from '@/components/AppLogo.vue'
import ChatPanel from '@/components/workspace/ChatPanel.vue'
import FileTree from '@/components/workspace/FileTree.vue'
import CodePanel from '@/components/workspace/CodePanel.vue'
import PreviewPanel from '@/components/workspace/PreviewPanel.vue'
import SnapshotSheet from '@/components/workspace/SnapshotSheet.vue'
import DiffDialog from '@/components/workspace/DiffDialog.vue'
import { createWorkspace } from '@/composables/useWorkspace'
import { useHighLevel } from '@/composables/useHighLevel'

const route = useRoute()
const ws = createWorkspace(String(route.params.id))
const hl = useHighLevel()

const historyOpen = ref(false)
const diffOpen = ref(false)
const diffId = ref<string | null>(null)
const view = ref<'code' | 'preview'>('preview')

function showDiff(gid: string) {
  diffId.value = gid
  diffOpen.value = true
}

function beforeUnload(e: BeforeUnloadEvent) {
  if (ws.dirty.length || ws.isStreaming) e.preventDefault()
}

onMounted(() => {
  ws.load()
  hl.refresh()
  window.addEventListener('beforeunload', beforeUnload)
})
onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', beforeUnload)
  if (ws.isStreaming) ws.cancel()
})
onBeforeRouteLeave(() => {
  if (ws.dirty.length) return window.confirm('You have unsaved changes. Leave anyway?')
  return true
})
</script>

<template>
  <div class="flex h-screen flex-col bg-background">
    <header class="flex h-12 shrink-0 items-center gap-3 border-b border-white/5 px-3">
      <Button as="router-link" to="/dashboard" size="icon-sm" variant="ghost" title="Back to dashboard"><ArrowLeft /></Button>
      <AppLogo size="sm" />
      <span class="text-muted-foreground">/</span>
      <span class="truncate text-sm font-medium">{{ ws.project?.name ?? 'Loading…' }}</span>
      <Badge v-if="ws.isStreaming" variant="info"><Loader2 class="animate-spin" /> Generating</Badge>

      <div class="ml-auto flex items-center gap-2">
        <Badge v-if="hl.status.value?.connected && !hl.status.value.needsReauth" variant="success">
          HL · {{ hl.status.value.locationName || hl.status.value.locationId }}
        </Badge>
        <Button v-else size="sm" variant="outline" @click="hl.connect()">
          <Link2 /> {{ hl.status.value?.needsReauth ? 'Reconnect' : 'Connect' }} HighLevel
        </Button>
        <div class="flex rounded-md border p-0.5 lg:hidden">
          <Button size="xs" :variant="view === 'code' ? 'secondary' : 'ghost'" @click="view = 'code'">Code</Button>
          <Button size="xs" :variant="view === 'preview' ? 'secondary' : 'ghost'" @click="view = 'preview'">Preview</Button>
        </div>
        <Button size="sm" variant="ghost" @click="historyOpen = true"><History /> History</Button>
        <Button size="sm" variant="secondary" :disabled="!ws.dirty.length || ws.isStreaming" @click="ws.saveAll()">
          <Save /> Save<span v-if="ws.dirty.length"> ({{ ws.dirty.length }})</span>
        </Button>
      </div>
    </header>

    <div v-if="ws.loadError" class="grid flex-1 place-items-center text-sm text-red-400">{{ ws.loadError }}</div>
    <div v-else-if="ws.loading && !ws.project" class="grid flex-1 place-items-center">
      <Loader2 class="size-6 animate-spin text-muted-foreground" />
    </div>
    <main v-else class="flex min-h-0 flex-1">
      <section class="w-[360px] shrink-0 border-r border-white/5">
        <ChatPanel :ws="ws" :hl-connected="!!hl.status.value?.connected" @diff="showDiff" />
      </section>
      <section :class="['min-w-0 flex-1 border-r border-white/5', view === 'code' ? 'flex' : 'hidden lg:flex']">
        <div class="w-52 shrink-0 border-r border-white/5"><FileTree :ws="ws" /></div>
        <div class="min-w-0 flex-1"><CodePanel :ws="ws" /></div>
      </section>
      <section :class="['min-w-0 flex-1', view === 'preview' ? 'block' : 'hidden lg:block']">
        <PreviewPanel :ws="ws" :hl="hl.status.value" />
      </section>
    </main>

    <SnapshotSheet v-model:open="historyOpen" :ws="ws" />
    <DiffDialog v-model:open="diffOpen" :project-id="ws.projectId" :generation-id="diffId" />
  </div>
</template>
