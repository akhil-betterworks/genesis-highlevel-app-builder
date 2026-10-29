/**
 * Vercel serverless entry. All `/api/*` requests are rewritten here (see vercel.json); Express
 * routes are already mounted under `/api`, so the original URL is handled unchanged.
 */
import app from '../src/standalone'

export default app
