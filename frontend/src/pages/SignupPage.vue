<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Loader2, AlertCircle, ArrowRight, Check } from 'lucide-vue-next'
import AuthShell from '@/components/AuthShell.vue'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { authErrorMessage, useAuth } from '@/composables/useAuth'

const router = useRouter()
const { signUp } = useAuth()

const name = ref('')
const email = ref('')
const password = ref('')
const confirm = ref('')
const loading = ref(false)
const error = ref('')

const checks = computed(() => [
  { ok: password.value.length >= 8, label: '8+ characters' },
  { ok: /[A-Z]/.test(password.value) && /[a-z]/.test(password.value), label: 'Upper & lower case' },
  { ok: /\d/.test(password.value), label: 'A number' },
])
const strength = computed(() => checks.value.filter((c) => c.ok).length)

async function submit() {
  error.value = ''
  if (password.value !== confirm.value) return (error.value = 'Passwords do not match.')
  if (strength.value < 2) return (error.value = 'Please choose a stronger password.')
  loading.value = true
  try {
    await signUp(email.value, password.value, name.value.trim() || undefined)
    await router.replace('/dashboard')
  } catch (e) {
    error.value = authErrorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell eyebrow="Get started" title="Create your account" subtitle="Free to try. Connect HighLevel in one click after signing up.">
    <form class="space-y-4" @submit.prevent="submit">
      <div class="space-y-2">
        <Label for="name">Name <span class="text-muted-foreground">(optional)</span></Label>
        <Input id="name" v-model="name" autocomplete="name" placeholder="Ada Lovelace" class="h-11" />
      </div>
      <div class="space-y-2">
        <Label for="email">Email</Label>
        <Input id="email" v-model="email" type="email" autocomplete="email" required placeholder="you@company.com" class="h-11" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div class="space-y-2">
          <Label for="password">Password</Label>
          <Input id="password" v-model="password" type="password" autocomplete="new-password" required minlength="6" class="h-11" />
        </div>
        <div class="space-y-2">
          <Label for="confirm">Confirm</Label>
          <Input id="confirm" v-model="confirm" type="password" autocomplete="new-password" required minlength="6" class="h-11" />
        </div>
      </div>

      <div v-if="password" class="space-y-2">
        <div class="flex gap-1.5">
          <div
            v-for="i in 3"
            :key="i"
            :class="[
              'h-1 flex-1 rounded-full transition-colors',
              i <= strength ? (strength === 3 ? 'bg-emerald-400' : strength === 2 ? 'bg-amber-400' : 'bg-red-400') : 'bg-muted',
            ]"
          />
        </div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span v-for="c in checks" :key="c.label" :class="['inline-flex items-center gap-1', c.ok ? 'text-emerald-400' : 'text-muted-foreground']">
            <Check class="size-3" /> {{ c.label }}
          </span>
        </div>
      </div>

      <Alert v-if="error" variant="destructive">
        <AlertCircle />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <Button type="submit" variant="gradient" size="lg" class="w-full" :disabled="loading">
        <Loader2 v-if="loading" class="animate-spin" />
        {{ loading ? 'Creating account…' : 'Create account' }}
        <ArrowRight v-if="!loading" />
      </Button>
    </form>
    <template #footer>
      Already have an account?
      <RouterLink to="/login" class="font-medium text-indigo-300 hover:text-indigo-200 hover:underline">Sign in</RouterLink>
    </template>
  </AuthShell>
</template>
