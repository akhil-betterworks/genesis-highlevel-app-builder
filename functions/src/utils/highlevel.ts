import axios from 'axios'
import * as admin from 'firebase-admin'

const HL_API_BASE = 'https://services.highlevel.com/oauth'
const HL_API_V3 = 'https://services.highlevel.com/v3'

const clientId = process.env.HIGHLEVEL_CLIENT_ID
const clientSecret = process.env.HIGHLEVEL_CLIENT_SECRET
const redirectUri = process.env.HIGHLEVEL_OAUTH_REDIRECT_URI

export async function getAccessToken(code: string) {
  try {
    const response = await axios.post(`${HL_API_BASE}/token`, {
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    })

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      locationId: response.data.location_id,
    }
  } catch (error: any) {
    throw new Error(`Failed to exchange authorization code: ${error.message}`)
  }
}

export async function refreshAccessToken(refreshToken: string) {
  try {
    const response = await axios.post(`${HL_API_BASE}/token`, {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      redirect_uri: redirectUri,
    })

    return {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
    }
  } catch (error: any) {
    throw new Error(`Failed to refresh token: ${error.message}`)
  }
}

export async function getHighLevelContacts(
  accessToken: string,
  locationId: string,
  query?: string
) {
  try {
    const response = await axios.get(`${HL_API_V3}/crm/contacts`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Location-Id': locationId,
      },
      params: {
        limit: 50,
        query,
      },
    })
    return response.data
  } catch (error: any) {
    throw new Error(`Failed to fetch contacts: ${error.message}`)
  }
}

export async function getHighLevelConversations(
  accessToken: string,
  locationId: string
) {
  try {
    const response = await axios.get(`${HL_API_V3}/conversations`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Location-Id': locationId,
      },
      params: {
        limit: 50,
      },
    })
    return response.data
  } catch (error: any) {
    throw new Error(`Failed to fetch conversations: ${error.message}`)
  }
}

export async function getHighLevelCalendars(
  accessToken: string,
  locationId: string
) {
  try {
    const response = await axios.get(`${HL_API_V3}/calendars`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Location-Id': locationId,
      },
    })
    return response.data
  } catch (error: any) {
    throw new Error(`Failed to fetch calendars: ${error.message}`)
  }
}

export async function getHighLevelAppointments(
  accessToken: string,
  locationId: string,
  calendarId: string
) {
  try {
    const response = await axios.get(`${HL_API_V3}/calendars/${calendarId}/appointments`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Location-Id': locationId,
      },
      params: {
        limit: 50,
      },
    })
    return response.data
  } catch (error: any) {
    throw new Error(`Failed to fetch appointments: ${error.message}`)
  }
}

export async function storeHighLevelTokens(
  uid: string,
  locationId: string,
  accessToken: string,
  refreshToken: string,
  expiresIn: number
) {
  const db = admin.firestore()
  const expiresAt = new Date(Date.now() + expiresIn * 1000)

  await db.collection('users').doc(uid).collection('highlevelTokens').doc(locationId).set(
    {
      accessToken,
      refreshToken,
      expiresAt,
      locationId,
      updatedAt: new Date(),
    },
    { merge: true }
  )
}

export async function getStoredHighLevelToken(uid: string, locationId?: string) {
  const db = admin.firestore()
  const userRef = db.collection('users').doc(uid)

  if (locationId) {
    const doc = await userRef.collection('highlevelTokens').doc(locationId).get()
    return doc.exists ? doc.data() : null
  } else {
    // Get the first (and typically only) location
    const snap = await userRef.collection('highlevelTokens').limit(1).get()
    return snap.docs.length > 0 ? snap.docs[0].data() : null
  }
}
