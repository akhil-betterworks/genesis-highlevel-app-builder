import { ref } from 'vue'
import { api } from '@/lib/api'
import type { HlStatus } from '@/lib/types'

const status = ref<HlStatus | null>(null)
const loading = ref(false)
let inflight: Promise<HlStatus> | null = null

export function useHighLevel() {
  async function refresh(): Promise<HlStatus> {
    inflight ??= (async () => {
      loading.value = true
      try {
        status.value = await api.hlStatus()
        return status.value
      } finally {
        loading.value = false
        inflight = null
      }
    })()
    return inflight
  }

  async function connect(returnTo = window.location.pathname) {
    const { url } = await api.hlStart(returnTo)
    window.location.assign(url)
  }

  async function disconnect() {
    await api.hlDisconnect()
    await refresh()
  }

  return { status, loading, refresh, connect, disconnect }
}
