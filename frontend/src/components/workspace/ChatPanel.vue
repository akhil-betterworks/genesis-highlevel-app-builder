<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { ArrowUp, Bot, FileDiff, FileMinus, FilePlus, FilePen, Loader2, Square, User, AlertTriangle } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Workspace } from '@/composables/useWorkspace'

const props = defineProps<{ ws: Workspace; hlConnected: boolean }>()
const emit = defineEmits<{ (e: 'diff', generationId: string): void }>()

const prompt = ref('')
const scroller = ref<HTMLElement | null>(null)
const input = ref<HTMLTextAreaElement | null>(null)

const suggestions = computed(() =>
  props.ws.files.size
    ? ['Add a search box with debounced filtering', 'Add pagination with a "Load more" button', 'Show a details drawer when I click a row']
    : [
        'Build a contact dashboard with search and a list of upcoming appointments',
        'Build an inbox that lists unread conversations and lets me reply by SMS',
        'Show this week’s free booking slots for each calendar',
      ],
)

const stageLabel = computed(
  () =>
    ({
      idle: '',
      context: 'Reading project & HighLevel context',
      generating: props.ws.streamingPath ? `Writing ${props.ws.streamingPath}` : 'Thinking',
      applying: 'Saving files & snapshot',
      reconciling: 'Recovering saved results',
    })[props.ws.stage],
)

function send(text = prompt.value) {
  const t = text.trim()
  if (!t || props.ws.isStreaming) return
  prompt.value = ''
  void props.ws.generate(t)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    send()
  }
}

watch(
  () => [props.ws.messages.length, props.ws.stage, props.ws.streamingPath],
  async () => {
    await nextTick()
    scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
  },
)

const changeIcon = { added: FilePlus, modified: FilePen, deleted: FileMinus }
const statusVariant = (s?: string) =>
  s === 'completed' ? 'success' : s === 'partial' ? 'warning' : s === 'failed' ? 'destructive' : s === 'cancelled' ? 'secondary' : 'outline'
</script>

<template>
  <div class="flex h-full flex-col">
    <div ref="scroller" class="scrollbar-thin flex-1 space-y-5 overflow-y-auto p-4">
      <div v-if="!ws.messages.length" class="pt-6 text-center">
        <div class="mx-auto grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-cyan-400/20 via-indigo-500/20 to-fuchsia-500/20">
          <Bot class="size-6 text-indigo-300" />
        </div>
        <p class="mt-4 font-medium">What should we build?</p>
        <p class="mt-1 text-sm text-muted-foreground">Describe an app — Genesis writes it against your HighLevel data.</p>
      </div>

      <div v-for="m in ws.messages" :key="m.id" class="flex gap-3">
        <div
          :class="[
            'grid size-7 shrink-0 place-items-center rounded-full',
            m.role === 'user' ? 'bg-secondary' : 'bg-gradient-to-br from-cyan-400 via-indigo-500 to-fuchsia-500',
          ]"
        >
          <User v-if="m.role === 'user'" class="size-3.5" />
          <Bot v-else class="size-3.5 text-white" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-medium text-muted-foreground">{{ m.role === 'user' ? 'You' : 'Genesis' }}</p>
          <div v-if="m.pending && !m.content" class="mt-1 text-sm">
            <span class="shimmer-text font-medium">{{ stageLabel || 'Working' }}…</span>
          </div>
          <p v-else class="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{{ m.content }}</p>

          <div v-if="m.role === 'assistant' && (m.changes?.length || (m.status && m.status !== 'completed'))" class="mt-2 space-y-2">
            <div class="flex flex-wrap items-center gap-1.5">
              <Badge v-if="m.status && m.status !== 'completed'" :variant="statusVariant(m.status)">
                <AlertTriangle v-if="m.status !== 'cancelled'" /> {{ m.status }}
              </Badge>
              <Badge v-for="c in m.changes" :key="c.path" variant="outline" class="cursor-pointer font-mono hover:border-indigo-400/50" @click="ws.openFile(c.path)">
                <component :is="changeIcon[c.type]" :class="c.type === 'added' ? 'text-emerald-400' : c.type === 'deleted' ? 'text-red-400' : 'text-amber-400'" />
                {{ c.path }}
              </Badge>
            </div>
            <Button v-if="m.generationId && m.changes?.length" variant="link" size="xs" class="h-auto px-0" @click="emit('diff', m.generationId!)">
              <FileDiff /> View changes
            </Button>
          </div>
        </div>
      </div>
    </div>

    <div class="border-t border-white/5 p-3">
      <div v-if="ws.isStreaming" class="mb-2 flex items-center justify-between rounded-lg border border-indigo-400/20 bg-indigo-500/10 px-3 py-2 text-xs">
        <span class="flex items-center gap-2"><Loader2 class="size-3.5 animate-spin text-indigo-300" /> {{ stageLabel }}…</span>
        <Button variant="ghost" size="xs" @click="ws.cancel()"><Square class="size-3" /> Stop</Button>
      </div>
      <div v-else-if="!ws.messages.length || ws.messages.length < 2" class="mb-2 flex flex-wrap gap-1.5">
        <button
          v-for="s in suggestions"
          :key="s"
          class="rounded-full border bg-card/60 px-2.5 py-1 text-left text-xs text-muted-foreground transition hover:border-indigo-400/50 hover:text-foreground"
          @click="send(s)"
        >
          {{ s }}
        </button>
      </div>
      <p v-if="!hlConnected" class="mb-2 text-xs text-amber-300/90">
        HighLevel isn’t connected — the preview will show a “connect” notice instead of live data.
      </p>
      <div class="relative rounded-xl border bg-background/60 focus-within:border-indigo-400/60 focus-within:ring-2 focus-within:ring-indigo-400/20">
        <textarea
          ref="input"
          v-model="prompt"
          rows="3"
          maxlength="8000"
          :disabled="ws.isStreaming"
          placeholder="Describe what to build or change…  (Enter to send, Shift+Enter for newline)"
          class="w-full resize-none bg-transparent px-3 py-2.5 pr-12 text-sm outline-none placeholder:text-muted-foreground disabled:opacity-60"
          @keydown="onKey"
        />
        <Button
          size="icon-sm"
          variant="gradient"
          class="absolute bottom-2 right-2 rounded-lg"
          :disabled="!prompt.trim() || ws.isStreaming"
          aria-label="Send"
          @click="send()"
        >
          <ArrowUp />
        </Button>
      </div>
    </div>
  </div>
</template>
