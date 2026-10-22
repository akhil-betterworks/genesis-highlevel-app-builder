import * as admin from 'firebase-admin'
import { CallableContext } from 'firebase-functions/v1/functions'

export async function verifyAuth(context: CallableContext): Promise<string> {
  if (!context.auth?.uid) {
    throw new Error('Unauthenticated')
  }
  return context.auth.uid
}

export async function verifyFirebaseToken(token: string): Promise<string> {
  try {
    const decodedToken = await admin.auth().verifyIdToken(token)
    return decodedToken.uid
  } catch {
    throw new Error('Invalid token')
  }
}

export async function getUserFromRequest(request: any): Promise<string> {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('Missing authorization header')
  }

  const token = authHeader.slice(7)
  return verifyFirebaseToken(token)
}
