<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Loader2, AlertCircle, Eye, EyeOff, ArrowRight } from 'lucide-vue-next'
import AuthShell from '@/components/AuthShell.vue'
import { Button } from '@/components/ui/button'
import Input from '@/components/ui/input/Input.vue'
import Label from '@/components/ui/label/Label.vue'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { authErrorMessage, useAuth } from '@/composables/useAuth'

const router = useRouter()
const route = useRoute()
const { signIn } = useAuth()

const email = ref('')
const password = ref('')
const show = ref(false)
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''
  loading.value = true
  try {
    await signIn(email.value, password.value)
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/dashboard'
    await router.replace(redirect)
  } catch (e) {
    error.value = authErrorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthShell eyebrow="Welcome back" title="Sign in to Genesis" subtitle="Pick up right where you left off.">
    <form class="space-y-5" @submit.prevent="submit">
      <div class="space-y-2">
        <Label for="email">Email</Label>
        <Input id="email" v-model="email" type="email" autocomplete="email" required placeholder="you@company.com" class="h-11" />
      </div>
      <div class="space-y-2">
        <Label for="password">Password</Label>
        <div class="relative">
          <Input
            id="password"
            v-model="password"
            :type="show ? 'text' : 'password'"
            autocomplete="current-password"
            required
            placeholder="••••••••"
            class="h-11 pr-10"
          />
          <button
            type="button"
            class="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
            :aria-label="show ? 'Hide password' : 'Show password'"
            @click="show = !show"
          >
            <EyeOff v-if="show" class="size-4" />
            <Eye v-else class="size-4" />
          </button>
        </div>
      </div>

      <Alert v-if="error" variant="destructive">
        <AlertCircle />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <Button type="submit" variant="gradient" size="lg" class="w-full" :disabled="loading">
        <Loader2 v-if="loading" class="animate-spin" />
        {{ loading ? 'Signing in…' : 'Sign in' }}
        <ArrowRight v-if="!loading" />
      </Button>
    </form>
    <template #footer>
      New to Genesis?
      <RouterLink to="/signup" class="font-medium text-indigo-300 hover:text-indigo-200 hover:underline">Create an account</RouterLink>
    </template>
  </AuthShell>
</template>
