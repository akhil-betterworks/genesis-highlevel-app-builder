import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { verifyAuth, getUserFromRequest } from '../utils/auth'
import {
  getAccessToken,
  refreshAccessToken,
  storeHighLevelTokens,
  getStoredHighLevelToken,
} from '../utils/highlevel'
import { CallableContext } from 'firebase-functions/v1/functions'

const db = admin.firestore()

export const setupHighLevelRoutes = {
  async getOAuthUrl(data: any, context: CallableContext) {
    const uid = await verifyAuth(context)

    const clientId = process.env.HIGHLEVEL_CLIENT_ID
    const redirectUri = process.env.HIGHLEVEL_OAUTH_REDIRECT_URI

    const state = Buffer.from(JSON.stringify({ uid, timestamp: Date.now() })).toString('base64')

    const url = new URL('https://services.highlevel.com/oauth/chooselocation')
    url.searchParams.set('client_id', clientId || '')
    url.searchParams.set('redirect_uri', redirectUri || '')
    url.searchParams.set('state', state)
    url.searchParams.set('response_type', 'code')

    return { url: url.toString() }
  },

  async handleCallback(request: any, response: any) {
    const { code, state } = request.body

    if (!code || !state) {
      return response.status(400).json({ error: 'Missing code or state' })
    }

    try {
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString())
      const uid = decodedState.uid

      // Exchange code for tokens
      const { accessToken, refreshToken, expiresIn, locationId } = await getAccessToken(code)

      // Store tokens
      await storeHighLevelTokens(uid, locationId, accessToken, refreshToken, expiresIn)

      // Update user profile
      await db.collection('users').doc(uid).update({
        highlevelConnected: true,
        highlevelLocationId: locationId,
      })

      // Redirect to dashboard
      const redirectUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:3000')
      redirectUrl.pathname = '/dashboard'
      redirectUrl.searchParams.set('connected', 'true')

      return response.redirect(redirectUrl.toString())
    } catch (error: any) {
      const errorUrl = new URL(process.env.FRONTEND_URL || 'http://localhost:3000')
      errorUrl.pathname = '/dashboard'
      errorUrl.searchParams.set('error', error.message)

      return response.redirect(errorUrl.toString())
    }
  },

  async getStatus(data: any, context: CallableContext) {
    const uid = await verifyAuth(context)

    const userDoc = await db.collection('users').doc(uid).get()
    if (!userDoc.exists) {
      return { connected: false }
    }

    const userData = userDoc.data()
    return {
      connected: userData?.highlevelConnected || false,
      locationId: userData?.highlevelLocationId || null,
    }
  },

  async refreshTokens() {
    try {
      const usersSnapshot = await db.collection('users').get()

      for (const userDoc of usersSnapshot.docs) {
        const uid = userDoc.id
        const tokensSnapshot = await db
          .collection('users')
          .doc(uid)
          .collection('highlevelTokens')
          .get()

        for (const tokenDoc of tokensSnapshot.docs) {
          const tokenData = tokenDoc.data()
          const expiresAt = new Date(tokenData.expiresAt.seconds * 1000)

          // Refresh if expiring within 1 hour
          if (expiresAt.getTime() - Date.now() < 3600000) {
            try {
              const { accessToken, refreshToken, expiresIn } = await refreshAccessToken(
                tokenData.refreshToken
              )

              await storeHighLevelTokens(
                uid,
                tokenData.locationId,
                accessToken,
                refreshToken,
                expiresIn
              )

              functions.logger.log(`Refreshed token for user ${uid}`)
            } catch (error) {
              functions.logger.error(`Failed to refresh token for user ${uid}:`, error)
            }
          }
        }
      }

      return { success: true }
    } catch (error) {
      functions.logger.error('Token refresh job failed:', error)
      throw error
    }
  },
}
