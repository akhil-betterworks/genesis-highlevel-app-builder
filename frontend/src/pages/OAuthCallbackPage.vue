<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { API_BASE } from '@/lib/api'

/**
 * HighLevel redirects the browser to `<site>/oauth/callback?code=…&state=…` (the URL registered in
 * the Marketplace app). When the API runs on a different origin, forward the query to the API's
 * callback, which validates the single-use state, exchanges the code and redirects back here.
 */
const failed = ref(false)
onMounted(() => {
  const target = `${API_BASE}/oauth/callback${window.location.search}`
  if (!window.location.search) {
    failed.value = true
    return
  }
  window.location.replace(target)
})
</script>

<template>
  <div class="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
    <p v-if="failed">Invalid HighLevel callback. <a class="underline" href="/dashboard">Back to dashboard</a></p>
    <p v-else class="shimmer-text">Finishing HighLevel connection…</p>
  </div>
</template>
