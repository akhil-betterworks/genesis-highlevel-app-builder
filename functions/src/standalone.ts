/**
 * Standalone entry (no Cloud Functions runtime) — used to host the API on a free Node host
 * (Vercel Hobby) while Firebase Spark provides Hosting, Auth and Firestore.
 *
 * Credentials: a Firebase service account via FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL /
 * FIREBASE_PRIVATE_KEY. Config & secrets are plain env vars (firebase-functions params resolve
 * from process.env outside the Functions runtime).
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app'

if (!getApps().length) {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY')
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }), projectId })
}

// Imported after admin init so lib/firestore reuses this app instead of default credentials.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createApp } = require('./app') as typeof import('./app')

export const app = createApp()
export default app

if (require.main === module) {
  const port = Number(process.env.PORT) || 8787
  app.listen(port, () => console.log(`Genesis API listening on :${port}`))
}
