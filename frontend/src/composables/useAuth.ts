import { computed, ref } from 'vue'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'

const user = ref<User | null>(null)
const ready = ref(false)
let readyPromise: Promise<void> | null = null

export function waitForAuth(): Promise<void> {
  readyPromise ??= new Promise((resolve) => {
    onAuthStateChanged(auth, (u) => {
      user.value = u
      if (!ready.value) {
        ready.value = true
        resolve()
      }
    })
  })
  return readyPromise
}

const FRIENDLY: Record<string, string> = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/invalid-email': 'That email address looks invalid.',
  'auth/user-not-found': 'No account found with that email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password must be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your connection (or that the emulators are running).',
}

export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string })?.code ?? ''
  return FRIENDLY[code] ?? (e as Error)?.message ?? 'Something went wrong'
}

export function useAuth() {
  return {
    user,
    ready,
    isAuthed: computed(() => !!user.value),
    signIn: (email: string, password: string) => signInWithEmailAndPassword(auth, email.trim(), password),
    signUp: async (email: string, password: string, name?: string) => {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password)
      if (name) await updateProfile(cred.user, { displayName: name })
      return cred
    },
    signOut: () => fbSignOut(auth),
  }
}
