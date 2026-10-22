<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
    <div class="text-center">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
      <h1 class="text-xl text-white font-semibold">Connecting your HighLevel account...</h1>
      <p class="text-gray-300 mt-2">{{ message }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { apiClient } from '../services/api'

const router = useRouter()
const route = useRoute()
const message = ref('Please wait while we verify your credentials...')

onMounted(async () => {
  const code = route.query.code as string
  const state = route.query.state as string

  if (!code) {
    message.value = 'Authorization code not found'
    setTimeout(() => router.push('/dashboard'), 2000)
    return
  }

  try {
    const response = await apiClient.post('/oauth/callback', { code, state })
    message.value = 'Account connected successfully!'
    setTimeout(() => router.push('/dashboard'), 1500)
  } catch (error: any) {
    message.value = error.response?.data?.error || 'Failed to connect account'
    setTimeout(() => router.push('/dashboard'), 2000)
  }
})
</script>
