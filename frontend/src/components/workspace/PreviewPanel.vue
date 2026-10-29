<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ExternalLink, MonitorSmartphone, RotateCw, Smartphone, Terminal, Trash2, Laptop } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { api } from '@/lib/api'
import { attachBridge, buildPreviewDoc } from '@/lib/preview'
import type { Workspace } from '@/composables/useWorkspace'
import type { HlStatus } from '@/lib/types'

const props = defineProps<{ ws: Workspace; hl: HlStatus | null }>()

const iframe = ref<HTMLIFrameElement | null>(null)
const channel = `genesis-${crypto.randomUUID()}`
const srcdoc = ref('')
const nonce = ref(0)
const logs = ref<{ level: string; message: string; at: number }[]>([])
const showConsole = ref(false)
const device = ref<'desktop' | 'mobile'>('desktop')
const requests = ref(0)

const errors = computed(() => logs.value.filter((l) => l.level === 'error').length)
const hasApp = computed(() => props.ws.previewFiles.length > 0)

function render() {
  logs.value = []
  const location = props.hl?.connected && !props.hl.needsReauth ? { id: props.hl.locationId!, name: props.hl.locationName ?? null } : null
  srcdoc.value = buildPreviewDoc(props.ws.previewFiles, { channel, location })
  nonce.value++
}

// Re-render after generation completes, restore, or a save — never mid-stream.
watch(
  () => [props.ws.previewVersion, props.hl?.connected, props.hl?.locationId],
  () => {
    if (!props.ws.isStreaming) render()
  },
  { immediate: true },
)

const detach = attachBridge(() => iframe.value, channel, {
  request: (req) => {
    requests.value++
    return api.hlProxy(req)
  },
  log: (level, message) => {
    logs.value.push({ level, message, at: Date.now() })
    if (logs.value.length > 200) logs.value.shift()
    if (level === 'error') showConsole.value = true
  },
})
onBeforeUnmount(detach)

function openStandalone() {
  // Data-URL tab for inspecting markup; HL calls need the parent bridge so they will show the notice.
  const blob = new Blob([srcdoc.value], { type: 'text/html' })
  window.open(URL.createObjectURL(blob), '_blank', 'noopener')
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex h-10 shrink-0 items-center gap-2 border-b border-white/5 bg-background/40 px-3">
      <span class="flex items-center gap-1.5 text-xs font-medium"><MonitorSmartphone class="size-3.5" /> Preview</span>
      <Badge v-if="hl?.connected && !hl.needsReauth" variant="success" class="ml-1">Live · {{ hl.locationName || 'HighLevel' }}</Badge>
      <Badge v-else variant="warning" class="ml-1">No HighLevel data</Badge>
      <span v-if="requests" class="text-[11px] text-muted-foreground">{{ requests }} API calls</span>
      <div class="ml-auto flex items-center gap-0.5">
        <Button size="icon-sm" variant="ghost" :class="device === 'desktop' && 'bg-accent'" title="Desktop" @click="device = 'desktop'">
          <Laptop />
        </Button>
        <Button size="icon-sm" variant="ghost" :class="device === 'mobile' && 'bg-accent'" title="Mobile" @click="device = 'mobile'">
          <Smartphone />
        </Button>
        <Button size="icon-sm" variant="ghost" title="Console" :class="showConsole && 'bg-accent'" @click="showConsole = !showConsole">
          <Terminal />
          <span v-if="errors" class="absolute -mt-4 ml-4 rounded-full bg-red-500 px-1 text-[9px] font-bold">{{ errors }}</span>
        </Button>
        <Button size="icon-sm" variant="ghost" title="Reload preview" :disabled="ws.isStreaming" @click="render"><RotateCw /></Button>
        <Button size="icon-sm" variant="ghost" title="Open markup in new tab" :disabled="!hasApp" @click="openStandalone"><ExternalLink /></Button>
      </div>
    </div>

    <div class="relative min-h-0 flex-1 bg-[radial-gradient(hsl(var(--border))_1px,transparent_1px)] [background-size:16px_16px]">
      <div v-if="!hasApp" class="grid h-full place-items-center text-center text-sm text-muted-foreground">
        <div>
          <MonitorSmartphone class="mx-auto size-8 opacity-40" />
          <p class="mt-2">Your app renders here after the first generation.</p>
        </div>
      </div>
      <div v-else :class="['mx-auto h-full transition-all', device === 'mobile' ? 'max-w-[390px] py-4' : 'w-full']">
        <iframe
          :key="nonce"
          ref="iframe"
          title="App preview"
          :srcdoc="srcdoc"
          sandbox="allow-scripts allow-forms allow-modals"
          referrerpolicy="no-referrer"
          :class="['h-full w-full bg-white', device === 'mobile' && 'rounded-2xl border-4 border-slate-800 shadow-2xl']"
        />
      </div>
      <div
        v-if="ws.isStreaming && hasApp"
        class="absolute inset-0 grid place-items-center bg-background/60 text-sm backdrop-blur-[2px]"
      >
        <span class="shimmer-text font-medium">Preview refreshes when generation completes…</span>
      </div>
    </div>

    <div v-if="showConsole" class="h-40 shrink-0 border-t border-white/5 bg-black/40">
      <div class="flex items-center justify-between px-3 py-1 text-[11px] text-muted-foreground">
        <span>Console</span>
        <button class="hover:text-foreground" title="Clear" @click="logs = []"><Trash2 class="size-3" /></button>
      </div>
      <div class="scrollbar-thin h-[calc(100%-24px)] overflow-y-auto px-3 pb-2 font-mono text-[11px]">
        <p v-if="!logs.length" class="text-muted-foreground">No messages.</p>
        <p v-for="(l, i) in logs" :key="i" :class="l.level === 'error' ? 'text-red-400' : l.level === 'warn' ? 'text-amber-300' : ''">
          {{ l.message }}
        </p>
      </div>
    </div>
  </div>
</template>
