<script setup lang="ts">
import { ArrowRight, Blocks, Bot, Calendar, MessagesSquare, Users } from 'lucide-vue-next'
import AppLogo from '@/components/AppLogo.vue'
import { Button } from '@/components/ui/button'

const apis = [
  { icon: Users, name: 'Contacts', desc: 'Search, list, create & update with pagination' },
  { icon: MessagesSquare, name: 'Conversations', desc: 'Threads, messages and replies' },
  { icon: Calendar, name: 'Calendars', desc: 'Calendars, appointments & free slots' },
]
</script>

<template>
  <div class="aurora relative min-h-screen overflow-hidden">
    <div class="grid-bg pointer-events-none absolute inset-0" />
    <header class="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
      <AppLogo />
      <div class="flex items-center gap-2">
        <Button as-child variant="ghost"><RouterLink to="/login">Sign in</RouterLink></Button>
        <Button as-child variant="gradient"><RouterLink to="/signup">Get started</RouterLink></Button>
      </div>
    </header>

    <main class="relative z-10 mx-auto max-w-6xl px-6 pb-24 pt-16 text-center">
      <span class="glass inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-muted-foreground">
        <Bot class="size-3.5 text-indigo-300" /> AI app builder for the HighLevel marketplace
      </span>
      <h1 class="mx-auto mt-6 max-w-4xl text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
        Describe it.<br /><span class="text-gradient">Ship it to HighLevel.</span>
      </h1>
      <p class="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
        Chat with Genesis and watch a working app stream into a code editor and live preview — powered by your real contacts, conversations
        and appointments.
      </p>
      <div class="mt-10 flex justify-center gap-3">
        <Button as-child variant="gradient" size="lg"><RouterLink to="/signup">Start building <ArrowRight /></RouterLink></Button>
        <Button as-child variant="outline" size="lg"><RouterLink to="/login">I have an account</RouterLink></Button>
      </div>

      <div class="mx-auto mt-20 grid max-w-4xl gap-4 md:grid-cols-3">
        <div v-for="a in apis" :key="a.name" class="glass rounded-2xl p-6 text-left transition hover:-translate-y-1 hover:border-white/20">
          <div class="grid size-10 place-items-center rounded-lg bg-indigo-500/15"><component :is="a.icon" class="size-5 text-indigo-300" /></div>
          <p class="mt-4 font-semibold">{{ a.name }} API</p>
          <p class="mt-1 text-sm text-muted-foreground">{{ a.desc }}</p>
        </div>
      </div>
      <p class="mt-10 inline-flex items-center gap-2 text-xs text-muted-foreground"><Blocks class="size-3.5" /> Vue 3 · Firebase · Claude · SSE streaming</p>
    </main>
  </div>
</template>
