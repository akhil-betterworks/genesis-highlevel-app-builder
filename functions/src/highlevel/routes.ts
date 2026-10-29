import express, { type Router } from 'express'
import { z } from 'zod'
import { handler } from '../lib/http'
import { enforceRateLimit, RATE_RULES } from '../lib/rateLimit'
import { createAuthorizeUrl } from './oauth'
import { disconnect, getConnectionStatus } from './tokens'
import { hlRequest, matchRoute } from './api'

const ProxyBody = z.object({
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE']),
  path: z.string().min(1).max(300),
  query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  body: z.unknown().optional(),
})

export function hlRoutes(): Router {
  const r = express.Router()

  r.get(
    '/hl/status',
    handler(async (req, res) => {
      res.json(await getConnectionStatus(req.uid))
    }),
  )

  r.post(
    '/hl/oauth/start',
    handler(async (req, res) => {
      await enforceRateLimit(req.uid, RATE_RULES.oauth)
      const returnTo = typeof req.body?.returnTo === 'string' ? req.body.returnTo : '/dashboard'
      res.json({ url: await createAuthorizeUrl(req.uid, returnTo) })
    }),
  )

  r.delete(
    '/hl/connection',
    handler(async (req, res) => {
      await disconnect(req.uid)
      res.json({ ok: true })
    }),
  )

  /**
   * Brokered HighLevel access for generated apps running in the preview iframe.
   * The iframe never sees tokens; the parent forwards allow-listed calls here with the user's
   * Firebase ID token, and we attach the (server-held, encrypted-at-rest) HighLevel token.
   */
  r.post(
    '/hl/proxy',
    handler(async (req, res) => {
      await enforceRateLimit(req.uid, RATE_RULES.hlProxy)
      const body = ProxyBody.parse(req.body)
      const path = body.path.split('?')[0]
      matchRoute(body.method, path)
      const result = await hlRequest(req.uid, { method: body.method, path, query: body.query, body: body.body })
      res.status(200).json(result)
    }),
  )

  return r
}
