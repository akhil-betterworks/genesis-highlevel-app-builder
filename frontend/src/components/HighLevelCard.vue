<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import { CheckCircle2, Link2, Loader2, PlugZap, RefreshCw, Unplug, AlertTriangle, MapPin } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { useHighLevel } from '@/composables/useHighLevel'

const { status, loading, connect, disconnect } = useHighLevel()
const busy = ref<'connect' | 'disconnect' | null>(null)

async function onConnect() {
  busy.value = 'connect'
  try {
    await connect('/dashboard')
  } catch (e) {
    toast.error('Could not start HighLevel OAuth', { description: (e as Error).message })
    busy.value = null
  }
}

async function onDisconnect() {
  busy.value = 'disconnect'
  try {
    await disconnect()
    toast.success('HighLevel disconnected')
  } catch (e) {
    toast.error('Disconnect failed', { description: (e as Error).message })
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <Card class="relative overflow-hidden p-6">
    <div class="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-indigo-500/15 blur-3xl" />
    <div class="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
      <div class="flex items-start gap-4">
        <div
          :class="[
            'grid size-12 shrink-0 place-items-center rounded-xl',
            status?.connected && !status.needsReauth ? 'bg-emerald-500/15 text-emerald-400' : 'bg-indigo-500/15 text-indigo-300',
          ]"
        >
          <CheckCircle2 v-if="status?.connected && !status.needsReauth" class="size-6" />
          <AlertTriangle v-else-if="status?.needsReauth" class="size-6 text-amber-400" />
          <PlugZap v-else class="size-6" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="font-semibold">HighLevel connection</h2>
            <Skeleton v-if="loading && !status" class="h-5 w-24" />
            <Badge v-else-if="status?.needsReauth" variant="warning">Reauthorization needed</Badge>
            <Badge v-else-if="status?.connected" variant="success">Connected</Badge>
            <Badge v-else-if="status" variant="secondary">Not connected</Badge>
          </div>
          <p v-if="status?.connected" class="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
            <MapPin class="size-3.5" />
            <span class="font-medium text-foreground">{{ status.locationName || 'Unnamed location' }}</span>
            <span class="font-mono text-xs opacity-70">· {{ status.locationId }}</span>
          </p>
          <p v-else class="mt-1 text-sm text-muted-foreground">
            Connect a sub-account so generated apps can use your real Contacts, Conversations and Calendars.
          </p>
        </div>
      </div>

      <div class="flex shrink-0 gap-2">
        <template v-if="status?.connected">
          <Button variant="outline" size="sm" :disabled="!!busy" @click="onConnect">
            <Loader2 v-if="busy === 'connect'" class="animate-spin" /><RefreshCw v-else />
            {{ status.needsReauth ? 'Reconnect' : 'Switch location' }}
          </Button>
          <Button variant="ghost" size="sm" :disabled="!!busy" @click="onDisconnect">
            <Loader2 v-if="busy === 'disconnect'" class="animate-spin" /><Unplug v-else /> Disconnect
          </Button>
        </template>
        <Button v-else variant="gradient" :disabled="!!busy || (loading && !status)" @click="onConnect">
          <Loader2 v-if="busy === 'connect'" class="animate-spin" /><Link2 v-else /> Connect HighLevel
        </Button>
      </div>
    </div>
  </Card>
</template>
