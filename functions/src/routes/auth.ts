import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'

const db = admin.firestore()

export const setupAuthRoutes = {
  async signUp(data: any, context: any) {
    const { email, password, displayName } = data

    try {
      const user = await admin.auth().createUser({
        email,
        password,
        displayName,
      })

      // Create user profile in Firestore
      await db.collection('users').doc(user.uid).set({
        email,
        displayName: displayName || '',
        createdAt: new Date(),
        highlevelConnected: false,
      })

      return { uid: user.uid, email: user.email }
    } catch (error: any) {
      throw new functions.https.HttpsError('internal', error.message)
    }
  },

  async signIn(data: any, context: any) {
    // Note: Sign in is typically handled by Firebase client SDK
    // This is just a placeholder for profile fetching
    const { uid } = data

    try {
      const userDoc = await db.collection('users').doc(uid).get()
      if (!userDoc.exists) {
        throw new Error('User profile not found')
      }

      return userDoc.data()
    } catch (error: any) {
      throw new functions.https.HttpsError('internal', error.message)
    }
  },
}
