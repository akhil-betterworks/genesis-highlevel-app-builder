import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { setupAuthRoutes } from './routes/auth'
import { setupProjectRoutes } from './routes/projects'
import { setupGenerationRoutes } from './routes/generation'
import { setupHighLevelRoutes } from './routes/highlevel'

admin.initializeApp()

// Auth routes
export const signUp = functions.https.onCall(setupAuthRoutes.signUp)
export const signIn = functions.https.onCall(setupAuthRoutes.signIn)

// Project CRUD routes
export const createProject = functions.https.onCall(setupProjectRoutes.create)
export const getProjects = functions.https.onCall(setupProjectRoutes.list)
export const getProject = functions.https.onCall(setupProjectRoutes.get)
export const updateProject = functions.https.onCall(setupProjectRoutes.update)
export const deleteProject = functions.https.onCall(setupProjectRoutes.delete)

// File operations
export const getProjectFiles = functions.https.onCall(setupProjectRoutes.getFiles)
export const saveFile = functions.https.onCall(setupProjectRoutes.saveFile)
export const getFile = functions.https.onCall(setupProjectRoutes.getFile)

// Snapshots
export const getSnapshots = functions.https.onCall(setupProjectRoutes.getSnapshots)
export const restoreSnapshot = functions.https.onCall(setupProjectRoutes.restoreSnapshot)

// Generation with SSE
export const generateCode = functions.https.onRequest(setupGenerationRoutes.streamGeneration)

// HighLevel OAuth
export const getOAuthUrl = functions.https.onCall(setupHighLevelRoutes.getOAuthUrl)
export const oauthCallback = functions.https.onRequest(setupHighLevelRoutes.handleCallback)
export const getHighLevelStatus = functions.https.onCall(setupHighLevelRoutes.getStatus)

// Scheduled tasks for token refresh
export const refreshHighLevelTokens = functions.pubsub
  .schedule('every 24 hours')
  .onRun(setupHighLevelRoutes.refreshTokens)
