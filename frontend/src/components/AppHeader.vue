<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { LogOut } from 'lucide-vue-next'
import AppLogo from '@/components/AppLogo.vue'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { user, signOut } = useAuth()
const initials = computed(() => (user.value?.displayName || user.value?.email || '?').slice(0, 1).toUpperCase())

async function logout() {
  await signOut()
  router.replace('/login')
}
</script>

<template>
  <header class="sticky top-0 z-30 border-b border-white/5 bg-background/70 backdrop-blur-xl">
    <div class="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
      <AppLogo />
      <div class="flex items-center gap-3">
        <slot />
        <div class="hidden text-right sm:block">
          <p class="text-sm font-medium leading-tight">{{ user?.displayName || 'Builder' }}</p>
          <p class="text-xs text-muted-foreground">{{ user?.email }}</p>
        </div>
        <div class="grid size-9 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-sm font-semibold">
          {{ initials }}
        </div>
        <Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out" @click="logout"><LogOut /></Button>
      </div>
    </div>
  </header>
</template>
