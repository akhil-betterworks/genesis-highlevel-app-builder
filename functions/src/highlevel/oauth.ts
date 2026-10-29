import type { Request, Response } from 'express'
import { logger } from 'firebase-functions'
import { FieldValue } from 'firebase-admin/firestore'
import { FRONTEND_URL, HL_AUTHORIZE_URL, HL_CLIENT_ID, HL_REDIRECT_URI, HL_SCOPES, HL_VERSION_ID } from '../config'
import { db, paths } from '../lib/firestore'
import { randomToken, sha256 } from '../lib/crypto'
import { AppError } from '../lib/errors'
import { saveConnection, tokenRequest } from './tokens'
import { HL_API_BASE } from '../config'

const STATE_TTL_MS = 10 * 60 * 1000

/**
 * Step 1: create an unguessable, single-use, short-lived `state` bound to the signed-in Firebase
 * user. Only the SHA-256 of the state is stored, so a database read cannot be replayed.
 * This is what prevents OAuth CSRF / account-linking attacks (the old implementation used a
 * base64-encoded uid, which anyone could forge).
 */
export async function createAuthorizeUrl(uid: string, returnTo = '/dashboard'): Promise<string> {
  const state = randomToken(32)
  await paths.oauthState(sha256(state)).set({
    uid,
    returnTo: returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/dashboard',
    expiresAt: new Date(Date.now() + STATE_TTL_MS),
    createdAt: FieldValue.serverTimestamp(),
  })
  const url = new URL(HL_AUTHORIZE_URL)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', HL_CLIENT_ID.value())
  url.searchParams.set('redirect_uri', HL_REDIRECT_URI.value())
  url.searchParams.set('scope', HL_SCOPES.value())
  url.searchParams.set('state', state)
  if (HL_VERSION_ID.value()) url.searchParams.set('version_id', HL_VERSION_ID.value())
  return url.toString()
}

async function consumeState(state: string): Promise<{ uid: string; returnTo: string }> {
  const ref = paths.oauthState(sha256(state))
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists) throw new AppError('forbidden', 'OAuth state is invalid or was already used')
    const d = snap.data()!
    tx.delete(ref)
    if ((d.expiresAt as FirebaseFirestore.Timestamp).toMillis() < Date.now()) {
      throw new AppError('forbidden', 'OAuth state expired, please try connecting again')
    }
    return { uid: d.uid as string, returnTo: (d.returnTo as string) ?? '/dashboard' }
  })
}

async function fetchLocationName(accessToken: string, locationId: string): Promise<string | null> {
  try {
    const res = await fetch(`${HL_API_BASE}/locations/${encodeURIComponent(locationId)}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Version: '2021-07-28', Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { location?: { name?: string } }
    return body.location?.name ?? null
  } catch {
    return null
  }
}

function redirectToApp(res: Response, path: string, params: Record<string, string>) {
  const url = new URL(path, FRONTEND_URL.value())
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  res.redirect(302, url.toString())
}

/** Step 2: HighLevel redirects here with ?code&state. Exchange the code server-side and store tokens. */
export async function handleOAuthCallback(req: Request, res: Response) {
  const code = typeof req.query.code === 'string' ? req.query.code : ''
  const state = typeof req.query.state === 'string' ? req.query.state : ''
  const oauthError = typeof req.query.error === 'string' ? req.query.error : ''

  if (oauthError) return redirectToApp(res, '/dashboard', { hl: 'error', reason: oauthError.slice(0, 100) })
  if (!code || !state) {
    return redirectToApp(res, '/dashboard', { hl: 'error', reason: 'missing_code_or_state' })
  }

  try {
    const { uid, returnTo } = await consumeState(state)
    const tokens = await tokenRequest({ grant_type: 'authorization_code', code })
    const name = tokens.locationId ? await fetchLocationName(tokens.access_token, tokens.locationId) : null
    await saveConnection(uid, tokens, name)
    logger.info('HighLevel connected', { uid, locationId: tokens.locationId })
    return redirectToApp(res, returnTo, { hl: 'connected' })
  } catch (err) {
    const reason = err instanceof AppError ? err.message : 'token_exchange_failed'
    logger.error('OAuth callback failed', { err: String(err) })
    return redirectToApp(res, '/dashboard', { hl: 'error', reason })
  }
}
