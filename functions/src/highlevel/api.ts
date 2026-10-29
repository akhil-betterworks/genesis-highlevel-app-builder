import { HL_API_BASE } from '../config'
import { AppError } from '../lib/errors'
import { getValidConnection } from './tokens'

/**
 * Allow-list of HighLevel endpoints reachable through the proxy (used by generated apps and the
 * generation context builder). Each entry pins the API `Version` header that endpoint expects and
 * whether the location id must be injected server-side. Anything not listed is rejected — the
 * preview can never use the user's token to call arbitrary HighLevel APIs.
 */
interface Route {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  pattern: RegExp
  version: string
  locationIn?: 'query' | 'body'
}

const ID = '[A-Za-z0-9_-]{1,64}'
export const HL_ROUTES: Route[] = [
  // Contacts
  { method: 'GET', pattern: /^\/contacts\/?$/, version: '2021-07-28', locationIn: 'query' },
  { method: 'POST', pattern: /^\/contacts\/search\/?$/, version: '2021-07-28', locationIn: 'body' },
  { method: 'GET', pattern: new RegExp(`^/contacts/${ID}/?$`), version: '2021-07-28' },
  { method: 'POST', pattern: /^\/contacts\/?$/, version: '2021-07-28', locationIn: 'body' },
  { method: 'PUT', pattern: new RegExp(`^/contacts/${ID}/?$`), version: '2021-07-28' },
  { method: 'GET', pattern: new RegExp(`^/contacts/${ID}/notes/?$`), version: '2021-07-28' },
  { method: 'GET', pattern: new RegExp(`^/contacts/${ID}/appointments/?$`), version: '2021-07-28' },
  // Conversations
  { method: 'GET', pattern: /^\/conversations\/search\/?$/, version: '2021-04-15', locationIn: 'query' },
  { method: 'GET', pattern: new RegExp(`^/conversations/${ID}/?$`), version: '2021-04-15' },
  { method: 'GET', pattern: new RegExp(`^/conversations/${ID}/messages/?$`), version: '2021-04-15' },
  { method: 'POST', pattern: /^\/conversations\/messages\/?$/, version: '2021-04-15' },
  // Calendars
  { method: 'GET', pattern: /^\/calendars\/?$/, version: '2021-04-15', locationIn: 'query' },
  { method: 'GET', pattern: new RegExp(`^/calendars/${ID}/?$`), version: '2021-04-15' },
  { method: 'GET', pattern: /^\/calendars\/events\/?$/, version: '2021-04-15', locationIn: 'query' },
  { method: 'GET', pattern: new RegExp(`^/calendars/${ID}/free-slots/?$`), version: '2021-04-15' },
  { method: 'GET', pattern: new RegExp(`^/calendars/events/appointments/${ID}/?$`), version: '2021-04-15' },
  // Location (read-only metadata)
  { method: 'GET', pattern: new RegExp(`^/locations/${ID}/?$`), version: '2021-07-28' },
]

export function matchRoute(method: string, path: string): Route {
  if (path.includes('..') || path.includes('//') || !path.startsWith('/')) {
    throw new AppError('forbidden', 'Invalid HighLevel path')
  }
  const route = HL_ROUTES.find((r) => r.method === method.toUpperCase() && r.pattern.test(path))
  if (!route) throw new AppError('forbidden', `HighLevel endpoint not allowed: ${method} ${path}`)
  return route
}

export interface HlRequest {
  method: string
  path: string
  query?: Record<string, string | number | boolean | undefined>
  body?: unknown
}

export interface HlResponse {
  status: number
  data: unknown
}

/** Calls HighLevel on behalf of `uid`, injecting auth, version and locationId. Retries once on 401/429. */
export async function hlRequest(uid: string, req: HlRequest): Promise<HlResponse> {
  const route = matchRoute(req.method, req.path)
  let conn = await getValidConnection(uid)

  const doFetch = async (token: string) => {
    const url = new URL(HL_API_BASE + req.path)
    for (const [k, v] of Object.entries(req.query ?? {})) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
    }
    let body = req.body
    if (route.locationIn === 'query') url.searchParams.set('locationId', conn.locationId)
    if (route.locationIn === 'body') body = { ...(body as object), locationId: conn.locationId }
    const init: RequestInit = {
      method: route.method,
      headers: {
        Authorization: `Bearer ${token}`,
        Version: route.version,
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body !== undefined && route.method !== 'GET' ? JSON.stringify(body) : undefined,
    }
    // Transient network failures (DNS/TLS/socket reset) are retried once for idempotent GETs.
    try {
      return await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) })
    } catch (err) {
      if (route.method !== 'GET') throw new AppError('hl_api_error', 'Could not reach HighLevel. Please retry.')
      await new Promise((r) => setTimeout(r, 400))
      return fetch(url, { ...init, signal: AbortSignal.timeout(20_000) }).catch(() => {
        throw new AppError('hl_api_error', 'Could not reach HighLevel. Please retry.')
      })
    }
  }

  let res = await doFetch(conn.accessToken)
  if (res.status === 401) {
    conn = await getValidConnection(uid, true)
    res = await doFetch(conn.accessToken)
  } else if (res.status === 429) {
    const wait = Math.min(Number(res.headers.get('retry-after') ?? 1) * 1000, 5000)
    await new Promise((r) => setTimeout(r, wait))
    res = await doFetch(conn.accessToken)
  }

  const text = await res.text()
  let data: unknown = text
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    /* non-JSON body: keep text */
  }
  return { status: res.status, data }
}

/** Convenience wrapper that throws on non-2xx. */
export async function hlGet<T = unknown>(uid: string, path: string, query?: HlRequest['query']): Promise<T> {
  const res = await hlRequest(uid, { method: 'GET', path, query })
  if (res.status >= 400) {
    const msg = (res.data as { message?: string })?.message ?? `HighLevel API error ${res.status}`
    throw new AppError('hl_api_error', String(msg), { status: res.status })
  }
  return res.data as T
}
