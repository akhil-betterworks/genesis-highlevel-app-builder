import { onRequest } from 'firebase-functions/v2/https'
import { setGlobalOptions } from 'firebase-functions/v2'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from 'firebase-functions'
import { SECRETS } from './config'
import { createApp } from './app'
import { db } from './lib/firestore'
import { handleOAuthCallback } from './highlevel/oauth'

setGlobalOptions({ region: 'us-central1', maxInstances: 20 })

const app = createApp()

/** REST + SSE API. Served at /api/** via Firebase Hosting rewrite. */
export const api = onRequest(
  {
    secrets: SECRETS,
    timeoutSeconds: 540, // long-running SSE generations
    memory: '512MiB',
    concurrency: 40,
    invoker: 'public', // auth is enforced per-request with Firebase ID tokens
  },
  app,
)

/**
 * Dedicated OAuth redirect target (`.../oauthCallback`). Kept as its own function so the redirect
 * URI registered in the HighLevel marketplace app stays stable regardless of API routing.
 */
export const oauthCallback = onRequest({ secrets: SECRETS, invoker: 'public' }, (req, res) => {
  handleOAuthCallback(req, res).catch((err) => {
    logger.error('oauthCallback crashed', { err: String(err) })
    res.status(500).send('OAuth callback failed')
  })
})

/** Hourly housekeeping: purge expired OAuth states and rate-limit windows. */
export const cleanup = onSchedule('every 60 minutes', async () => {
  const now = new Date()
  for (const col of ['oauthStates', 'rateLimits']) {
    const snap = await db().collection(col).where('expiresAt', '<', now).limit(400).get()
    const batch = db().batch()
    snap.docs.forEach((d) => batch.delete(d.ref))
    if (!snap.empty) await batch.commit()
    logger.info(`cleanup ${col}`, { deleted: snap.size })
  }
})
