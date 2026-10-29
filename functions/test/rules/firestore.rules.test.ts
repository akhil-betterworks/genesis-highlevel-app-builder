import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, collection, getDocs, query, where } from 'firebase/firestore'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-genesis-rules',
    firestore: {
      rules: readFileSync(resolve(__dirname, '../../../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8080,
    },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users/alice'), { hl: { connected: true } })
    await setDoc(doc(db, 'users/alice/projects/p1'), { name: 'P1', deletedAt: null })
    await setDoc(doc(db, 'users/alice/projects/gone'), { name: 'Old', deletedAt: new Date() })
    await setDoc(doc(db, 'users/alice/projects/p1/files/f1'), { path: 'a.js', content: 'x' })
    await setDoc(doc(db, 'hlConnections/alice'), { accessTokenEnc: 'v1...' })
    await setDoc(doc(db, 'oauthStates/s1'), { uid: 'alice' })
  })
})

describe('firestore.rules', () => {
  it('owner can read own profile, project and files', async () => {
    const db = env.authenticatedContext('alice').firestore()
    await assertSucceeds(getDoc(doc(db, 'users/alice')))
    await assertSucceeds(getDoc(doc(db, 'users/alice/projects/p1')))
    await assertSucceeds(getDoc(doc(db, 'users/alice/projects/p1/files/f1')))
    await assertSucceeds(getDocs(query(collection(db, 'users/alice/projects'), where('deletedAt', '==', null))))
  })

  it('soft-deleted projects are hidden', async () => {
    const db = env.authenticatedContext('alice').firestore()
    await assertFails(getDoc(doc(db, 'users/alice/projects/gone')))
  })

  it('other users cannot read anything', async () => {
    const db = env.authenticatedContext('mallory').firestore()
    await assertFails(getDoc(doc(db, 'users/alice')))
    await assertFails(getDoc(doc(db, 'users/alice/projects/p1')))
    await assertFails(getDoc(doc(db, 'users/alice/projects/p1/files/f1')))
  })

  it('unauthenticated users cannot read', async () => {
    const db = env.unauthenticatedContext().firestore()
    await assertFails(getDoc(doc(db, 'users/alice/projects/p1')))
  })

  it('clients cannot write — even the owner (writes go through functions)', async () => {
    const db = env.authenticatedContext('alice').firestore()
    await assertFails(setDoc(doc(db, 'users/alice/projects/p2'), { name: 'x' }))
    await assertFails(setDoc(doc(db, 'users/alice/projects/p1/files/f2'), { path: 'b.js' }))
    await assertFails(setDoc(doc(db, 'users/alice'), { hl: { connected: true } }))
  })

  it('token and OAuth state collections are server-only', async () => {
    const db = env.authenticatedContext('alice').firestore()
    await assertFails(getDoc(doc(db, 'hlConnections/alice')))
    await assertFails(getDoc(doc(db, 'oauthStates/s1')))
    await assertFails(getDoc(doc(db, 'rateLimits/x')))
  })
})
