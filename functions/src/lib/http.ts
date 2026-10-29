import type { NextFunction, Request, Response, RequestHandler } from 'express'
import { logger } from 'firebase-functions'
import { adminAuth } from './firestore'
import { AppError, toAppError } from './errors'
import { ALLOWED_ORIGINS } from '../config'

export interface AuthedRequest extends Request<Record<string, string>> {
  uid: string
  email?: string
}

/** Verifies the Firebase ID token in `Authorization: Bearer <token>`. */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.headers.authorization ?? ''
    const match = /^Bearer (.+)$/.exec(header)
    if (!match) throw new AppError('unauthenticated', 'Missing bearer token')
    const decoded = await adminAuth()
      .verifyIdToken(match[1])
      .catch((e: { code?: string; message?: string }) => {
        logger.warn('verifyIdToken failed', { code: e?.code, message: e?.message })
        throw new AppError('unauthenticated', 'Invalid or expired session')
      })
    ;(req as AuthedRequest).uid = decoded.uid
    ;(req as AuthedRequest).email = decoded.email
    next()
  } catch (err) {
    next(err)
  }
}

/** Wraps async handlers so rejections reach the error middleware. */
export const handler =
  (fn: (req: AuthedRequest, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req as AuthedRequest, res).catch(next)
  }

export function cors(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin
  const allowed = ALLOWED_ORIGINS.value()
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean)
  if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    res.setHeader('Access-Control-Max-Age', '600')
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }
  next()
}

export function securityHeaders(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('Referrer-Policy', 'no-referrer')
  res.setHeader('Cache-Control', 'no-store')
  next()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  const appErr = toAppError(err)
  if (appErr.status >= 500) logger.error('Request failed', { path: req.path, err: String((err as Error)?.stack ?? err) })
  if (res.headersSent) {
    res.end()
    return
  }
  res.status(appErr.status).json({ error: { code: appErr.code, message: appErr.message, details: appErr.details } })
}
