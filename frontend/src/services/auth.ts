import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import { auth, db } from './firebase'
import { doc, setDoc, getDoc } from 'firebase/firestore'

export async function setupAuth() {
  return new Promise<void>((resolve) => {
    onAuthStateChanged(auth, (user) => {
      if (user) {
        localStorage.setItem('authUser', user.uid)
      } else {
        localStorage.removeItem('authUser')
      }
      resolve()
    })
  })
}

export async function signUp(email: string, password: string): Promise<User> {
  const { user } = await createUserWithEmailAndPassword(auth, email, password)

  // Create user profile in Firestore
  await setDoc(doc(db, 'users', user.uid), {
    email,
    createdAt: new Date(),
    highlevelConnected: false,
  })

  return user
}

export async function signIn(email: string, password: string): Promise<User> {
  const { user } = await signInWithEmailAndPassword(auth, email, password)
  return user
}

export async function logout(): Promise<void> {
  await signOut(auth)
  localStorage.removeItem('authUser')
}

export function getCurrentUser(): User | null {
  return auth.currentUser
}

export async function getUserProfile(uid: string) {
  const docSnap = await getDoc(doc(db, 'users', uid))
  return docSnap.exists() ? docSnap.data() : null
}
