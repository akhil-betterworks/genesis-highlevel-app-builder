import { logger } from 'firebase-functions'
import { FieldValue } from 'firebase-admin/firestore'
import { HL_API_BASE, HL_CLIENT_ID, HL_CLIENT_SECRET, HL_REDIRECT_URI, TOKEN_ENCRYPTION_KEY } from '../config'
import { paths, db } from '../lib/firestore'
import { decrypt, encrypt } from '../lib/crypto'
import { AppError } from '../lib/errors'

export interface HlTokenResponse {
  access_token: string
  refresh_token: string
  expires_in: number
  scope?: string
  userType?: string
  locationId?: string
  companyId?: string
  userId?: string
}

export interface HlConnection {
  locationId: string
  locationName: string | null
  companyId: string | null
  scope: string | null
  accessToken: string
  expiresAt: number
}

const REFRESH_SKEW_MS = 5 * 60 * 1000
const LOCK_MS = 20_000

export async function tokenRequest(params: Record<string, string>): Promise<HlTokenResponse> {
  const body = new URLSearchParams({
    client_id: HL_CLIENT_ID.value(),
    client_secret: HL_CLIENT_SECRET.value(),
    user_type: 'Location',
    redirect_uri: HL_REDIRECT_URI.value(),
    ...params,
  })
  const res = await fetch(`${HL_API_BASE}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  })
  const text = await res.text()
  if (!res.ok) {
    logger.warn('HighLevel token endpoint error', { status: res.status, body: text.slice(0, 500) })
    if (res.status === 400 || res.status === 401) {
      throw new AppError('hl_reauth_required', 'HighLevel authorization expired or was revoked. Please reconnect.')
    }
    throw new AppError('hl_api_error', `HighLevel token exchange failed (${res.status})`)
  }
  return JSON.parse(text) as HlTokenResponse
}

export async function saveConnection(uid: string, t: HlTokenResponse, locationName: string | null) {
  const key = TOKEN_ENCRYPTION_KEY.value()
  if (!t.locationId) throw new AppError('hl_api_error', 'HighLevel did not return a location. Choose a sub-account when connecting.')
  await paths.hlConnection(uid).set({
    uid,
    locationId: t.locationId,
    locationName,
    companyId: t.companyId ?? null,
    scope: t.scope ?? null,
    accessTokenEnc: encrypt(t.access_token, key),
    refreshTokenEnc: encrypt(t.refresh_token, key),
    expiresAt: Date.now() + t.expires_in * 1000,
    needsReauth: false,
    refreshLockUntil: 0,
    connectedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })
  // Public, non-sensitive mirror the client may read.
  await paths.user(uid).set(
    { hl: { connected: true, locationId: t.locationId, locationName, connectedAt: FieldValue.serverTimestamp() } },
    { merge: true },
  )
}

export async function disconnect(uid: string) {
  await paths.hlConnection(uid).delete()
  await paths.user(uid).set({ hl: { connected: false, locationId: null, locationName: null } }, { merge: true })
}

export async function getConnectionStatus(uid: string) {
  const snap = await paths.hlConnection(uid).get()
  if (!snap.exists) return { connected: false as const }
  const d = snap.data()!
  return {
    connected: true as const,
    locationId: d.locationId as string,
    locationName: (d.locationName as string | null) ?? null,
    needsReauth: Boolean(d.needsReauth),
    scope: (d.scope as string | null) ?? null,
  }
}

const inflight = new Map<string, Promise<HlConnection>>()

/**
 * Returns a connection with a valid access token, refreshing when it is within 5 minutes of expiry.
 * HighLevel refresh tokens are single-use, so concurrent refreshes would invalidate each other:
 * we de-duplicate in-process and take a short Firestore lease across instances.
 */
export async function getValidConnection(uid: string, forceRefresh = false): Promise<HlConnection> {
  const existing = inflight.get(uid)
  if (existing) return existing
  const p = resolveConnection(uid, forceRefresh).finally(() => inflight.delete(uid))
  inflight.set(uid, p)
  return p
}

async function resolveConnection(uid: string, forceRefresh: boolean, attempt = 0): Promise<HlConnection> {
  const key = TOKEN_ENCRYPTION_KEY.value()
  const ref = paths.hlConnection(uid)
  const snap = await ref.get()
  if (!snap.exists) throw new AppError('hl_not_connected', 'Connect your HighLevel account first.')
  const d = snap.data()!
  if (d.needsReauth) throw new AppError('hl_reauth_required', 'HighLevel authorization expired. Please reconnect.')

  const toConn = (data: FirebaseFirestore.DocumentData): HlConnection => ({
    locationId: data.locationId,
    locationName: data.locationName ?? null,
    companyId: data.companyId ?? null,
    scope: data.scope ?? null,
    accessToken: decrypt(data.accessTokenEnc, key),
    expiresAt: data.expiresAt,
  })

  if (!forceRefresh && d.expiresAt - Date.now() > REFRESH_SKEW_MS) return toConn(d)

  // Acquire refresh lease.
  const acquired = await db().runTransaction(async (tx) => {
    const cur = await tx.get(ref)
    const c = cur.data()!
    if (!forceRefresh && c.expiresAt - Date.now() > REFRESH_SKEW_MS) return false
    if ((c.refreshLockUntil ?? 0) > Date.now()) return false
    tx.update(ref, { refreshLockUntil: Date.now() + LOCK_MS })
    return true
  })

  if (!acquired) {
    if (attempt > 10) throw new AppError('hl_api_error', 'Timed out waiting for HighLevel token refresh')
    await new Promise((r) => setTimeout(r, 1000))
    const again = (await ref.get()).data()!
    if (again.expiresAt - Date.now() > REFRESH_SKEW_MS && !forceRefresh) return toConn(again)
    return resolveConnection(uid, false, attempt + 1)
  }

  try {
    const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: decrypt(d.refreshTokenEnc, key) })
    const update = {
      accessTokenEnc: encrypt(t.access_token, key),
      refreshTokenEnc: encrypt(t.refresh_token, key),
      expiresAt: Date.now() + t.expires_in * 1000,
      scope: t.scope ?? d.scope ?? null,
      refreshLockUntil: 0,
      updatedAt: FieldValue.serverTimestamp(),
    }
    await ref.update(update)
    return { ...toConn({ ...d, ...update }) }
  } catch (err) {
    if (err instanceof AppError && err.code === 'hl_reauth_required') {
      await ref.update({ needsReauth: true, refreshLockUntil: 0 })
      await paths.user(uid).set({ hl: { needsReauth: true } }, { merge: true })
    } else {
      await ref.update({ refreshLockUntil: 0 })
    }
    throw err
  }
}
