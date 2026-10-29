<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { Toaster } from 'vue-sonner'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { user, ready } = useAuth()

// If the session ends (sign-out in another tab, token revoked) leave protected pages.
watch(user, (u) => {
  if (ready.value && !u && router.currentRoute.value.meta.auth) router.replace({ name: 'login' })
})
</script>

<template>
  <RouterView />
  <Toaster theme="dark" position="bottom-right" rich-colors close-button />
</template>
