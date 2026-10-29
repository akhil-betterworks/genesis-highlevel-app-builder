import express from 'express'
import { cors, errorHandler, requireAuth, securityHeaders, handler } from './lib/http'
import { enforceRateLimit, RATE_RULES } from './lib/rateLimit'
import { AppError } from './lib/errors'
import { projectRoutes } from './projects/routes'
import { hlRoutes } from './highlevel/routes'
import { handleOAuthCallback } from './highlevel/oauth'
import { getConnectionStatus } from './highlevel/tokens'

/**
 * One Express app serves the whole REST + SSE surface. It is mounted both at the function root
 * (direct Cloud Functions URL) and under `/api` (Firebase Hosting rewrite → same origin as the SPA,
 * so the browser never needs CORS in production).
 */
export function createApp() {
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', true)
  app.use(securityHeaders)
  app.use(cors)
  app.use(express.json({ limit: '1mb' }))

  const router = express.Router()
  router.get('/health', (_req, res) => {
    res.json({ ok: true, time: Date.now() })
  })
  // Public: HighLevel redirects the browser here (state param authenticates the request).
  router.get('/oauth/callback', (req, res, next) => {
    handleOAuthCallback(req, res).catch(next)
  })

  router.use(requireAuth)
  router.use((req, _res, next) => {
    // Generation & proxy have dedicated, tighter limits.
    if (/\/(generate|hl\/proxy)$/.test(req.path)) return next()
    enforceRateLimit((req as unknown as { uid: string }).uid, RATE_RULES.api).then(() => next(), next)
  })
  router.get(
    '/me',
    handler(async (req, res) => {
      res.json({ uid: req.uid, email: req.email ?? null, hl: await getConnectionStatus(req.uid) })
    }),
  )
  router.use(projectRoutes())
  router.use(hlRoutes())
  router.use((_req, _res, next) => next(new AppError('not_found', 'Route not found')))

  app.use('/api', router)
  app.use('/', router)
  app.use(errorHandler)
  return app
}
