import { getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import { getAuth } from 'firebase-admin/auth'

if (!getApps().length) initializeApp()

let _db: Firestore | undefined
export function db(): Firestore {
  if (!_db) {
    _db = getFirestore()
    _db.settings({ ignoreUndefinedProperties: true })
  }
  return _db
}

export const adminAuth = () => getAuth()

/** Firestore layout — every path is derived from here so ownership is structural, not ad hoc. */
export const paths = {
  user: (uid: string) => db().collection('users').doc(uid),
  projects: (uid: string) => db().collection('users').doc(uid).collection('projects'),
  project: (uid: string, pid: string) => paths.projects(uid).doc(pid),
  files: (uid: string, pid: string) => paths.project(uid, pid).collection('files'),
  snapshots: (uid: string, pid: string) => paths.project(uid, pid).collection('snapshots'),
  messages: (uid: string, pid: string) => paths.project(uid, pid).collection('messages'),
  generations: (uid: string, pid: string) => paths.project(uid, pid).collection('generations'),
  // Server-only collections (denied to clients by security rules):
  hlConnection: (uid: string) => db().collection('hlConnections').doc(uid),
  oauthState: (state: string) => db().collection('oauthStates').doc(state),
  rateLimit: (key: string) => db().collection('rateLimits').doc(key),
}

/** Encode a file path into a Firestore-safe document id (reversible). */
export const fileId = (path: string) => Buffer.from(path).toString('base64url')
