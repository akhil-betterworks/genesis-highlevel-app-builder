<script setup lang="ts">
import { Sparkles, ShieldCheck, Zap, History } from 'lucide-vue-next'
import AppLogo from '@/components/AppLogo.vue'

defineProps<{ eyebrow: string; title: string; subtitle: string }>()

const features = [
  { icon: Zap, title: 'Prompt → working app', body: 'Describe it in plain English, watch code stream live.' },
  { icon: Sparkles, title: 'Real HighLevel data', body: 'Contacts, Conversations & Calendars via OAuth.' },
  { icon: History, title: 'Every version saved', body: 'Snapshot per generation, one-click restore.' },
  { icon: ShieldCheck, title: 'Secure by design', body: 'Encrypted tokens, sandboxed previews, scoped access.' },
]
</script>

<template>
  <div class="aurora relative min-h-screen overflow-hidden">
    <div class="grid-bg pointer-events-none absolute inset-0" />
    <div class="pointer-events-none absolute -left-32 top-24 size-96 animate-float rounded-full bg-cyan-500/20 blur-3xl" />
    <div class="pointer-events-none absolute -right-24 bottom-10 size-[28rem] animate-float rounded-full bg-indigo-600/25 blur-3xl [animation-delay:-4s]" />

    <div class="relative z-10 mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-12 px-6 py-10 lg:grid-cols-[1.1fr_1fr]">
      <section class="hidden lg:block">
        <AppLogo />
        <h1 class="mt-10 text-5xl font-bold leading-[1.05] tracking-tight">
          Build <span class="text-gradient">HighLevel apps</span><br />at the speed of thought.
        </h1>
        <p class="mt-5 max-w-lg text-lg text-muted-foreground">
          Genesis turns a prompt into a marketplace-ready app wired to your real CRM — streamed into a live editor and preview.
        </p>
        <div class="mt-10 grid max-w-xl grid-cols-2 gap-3">
          <div v-for="f in features" :key="f.title" class="glass rounded-xl p-4 transition hover:border-white/20 hover:bg-white/[0.06]">
            <component :is="f.icon" class="size-5 text-indigo-300" />
            <p class="mt-3 text-sm font-medium">{{ f.title }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ f.body }}</p>
          </div>
        </div>
      </section>

      <section class="w-full">
        <div class="mb-8 lg:hidden"><AppLogo /></div>
        <div class="relative mx-auto w-full max-w-md">
          <div class="absolute -inset-px rounded-2xl bg-gradient-to-br from-cyan-400/40 via-indigo-500/30 to-fuchsia-500/40 blur-sm" />
          <div class="relative rounded-2xl border border-white/10 bg-card/90 p-8 shadow-2xl backdrop-blur-xl">
            <p class="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">{{ eyebrow }}</p>
            <h2 class="mt-2 text-2xl font-bold tracking-tight">{{ title }}</h2>
            <p class="mt-1 text-sm text-muted-foreground">{{ subtitle }}</p>
            <div class="mt-7"><slot /></div>
          </div>
          <p class="mt-6 text-center text-sm text-muted-foreground"><slot name="footer" /></p>
        </div>
      </section>
    </div>
  </div>
</template>
