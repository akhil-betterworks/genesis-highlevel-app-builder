import { db, paths } from './firestore'
import { AppError } from './errors'

export interface RateRule {
  name: string
  limit: number
  windowMs: number
}

export const RATE_RULES = {
  generate: { name: 'generate', limit: 20, windowMs: 60 * 60 * 1000 },
  hlProxy: { name: 'hlProxy', limit: 240, windowMs: 60 * 1000 },
  api: { name: 'api', limit: 300, windowMs: 60 * 1000 },
  oauth: { name: 'oauth', limit: 10, windowMs: 10 * 60 * 1000 },
} satisfies Record<string, RateRule>

export function windowKey(uid: string, rule: RateRule, now: number) {
  return `${rule.name}_${uid}_${Math.floor(now / rule.windowMs)}`
}

/**
 * Fixed-window limiter backed by a Firestore transaction — works across all function instances.
 * Documents carry `expiresAt` so a Firestore TTL policy can garbage-collect them.
 */
export async function enforceRateLimit(uid: string, rule: RateRule, now = Date.now()) {
  const ref = paths.rateLimit(windowKey(uid, rule, now))
  const count = await db().runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const next = ((snap.data()?.count as number | undefined) ?? 0) + 1
    tx.set(ref, { count: next, expiresAt: new Date(now + rule.windowMs * 2) }, { merge: true })
    return next
  })
  if (count > rule.limit) {
    const retryAfter = Math.ceil((rule.windowMs - (now % rule.windowMs)) / 1000)
    throw new AppError('rate_limited', `Rate limit exceeded for ${rule.name}. Retry in ${retryAfter}s.`, { retryAfter })
  }
}
