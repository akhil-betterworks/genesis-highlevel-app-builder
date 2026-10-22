import * as functions from 'firebase-functions'
import * as admin from 'firebase-admin'
import { verifyAuth, getUserFromRequest } from '../utils/auth'
import { CallableContext } from 'firebase-functions/v1/functions'

const db = admin.firestore()

export const setupProjectRoutes = {
  async create(data: any, context: CallableContext) {
    const uid = await verifyAuth(context)

    const project = {
      name: data.name,
      description: data.description,
      highlevelLocationId: data.highlevelLocationId || '',
      createdAt: new Date(),
      updatedAt: new Date(),
      userId: uid,
      files: [],
    }

    const docRef = await db.collection('users').doc(uid).collection('projects').add(project)

    // Create initial empty files array
    await docRef.update({
      id: docRef.id,
    })

    return { id: docRef.id, ...project }
  },

  async list(data: any, context: CallableContext) {
    const uid = await verifyAuth(context)
    const snapshot = await db
      .collection('users')
      .doc(uid)
      .collection('projects')
      .orderBy('createdAt', 'desc')
      .get()

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))
  },

  async get(data: any, context: CallableContext) {
    const uid = await verifyAuth(context)
    const doc = await db
      .collection('users')
      .doc(uid)
      .collection('projects')
      .doc(data.projectId)
      .get()

    if (!doc.exists) {
      throw new functions.https.HttpsError('not-found', 'Project not found')
    }

    return { id: doc.id, ...doc.data() }
  },

  async update(data: any, context: CallableContext) {
    const uid = await verifyAuth(context)
    const projectRef = db.collection('users').doc(uid).collection('projects').doc(data.projectId)

    const doc = await projectRef.get()
    if (!doc.exists) {
      throw new functions.https.HttpsError('not-found', 'Project not found')
    }

    await projectRef.update({
      ...data.updates,
      updatedAt: new Date(),
    })

    const updated = await projectRef.get()
    return { id: updated.id, ...updated.data() }
  },

  async delete(data: any, context: CallableContext) {
    const uid = await verifyAuth(context)
    const projectRef = db.collection('users').doc(uid).collection('projects').doc(data.projectId)

    const doc = await projectRef.get()
    if (!doc.exists) {
      throw new functions.https.HttpsError('not-found', 'Project not found')
    }

    // Soft delete
    await projectRef.update({
      deletedAt: new Date(),
      isDeleted: true,
    })

    return { success: true }
  },

  async getFiles(data: any, context: CallableContext) {
    const uid = await verifyAuth(context)
    const projectRef = db.collection('users').doc(uid).collection('projects').doc(data.projectId)

    const doc = await projectRef.get()
    if (!doc.exists) {
      throw new functions.https.HttpsError('not-found', 'Project not found')
    }

    const filesSnapshot = await projectRef.collection('files').get()
    return filesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))
  },

  async getFile(data: any, context: CallableContext) {
    const uid = await verifyAuth(context)
    const fileDoc = await db
      .collection('users')
      .doc(uid)
      .collection('projects')
      .doc(data.projectId)
      .collection('files')
      .doc(data.fileId)
      .get()

    if (!fileDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'File not found')
    }

    return { id: fileDoc.id, ...fileDoc.data() }
  },

  async saveFile(data: any, context: CallableContext) {
    const uid = await verifyAuth(context)
    const fileRef = db
      .collection('users')
      .doc(uid)
      .collection('projects')
      .doc(data.projectId)
      .collection('files')
      .doc(data.fileId)

    const doc = await fileRef.get()
    if (!doc.exists) {
      throw new functions.https.HttpsError('not-found', 'File not found')
    }

    await fileRef.update({
      content: data.content,
      updatedAt: new Date(),
    })

    const updated = await fileRef.get()
    return { id: updated.id, ...updated.data() }
  },

  async getSnapshots(data: any, context: CallableContext) {
    const uid = await verifyAuth(context)
    const snapshotSnapshot = await db
      .collection('users')
      .doc(uid)
      .collection('projects')
      .doc(data.projectId)
      .collection('snapshots')
      .orderBy('timestamp', 'desc')
      .get()

    return snapshotSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }))
  },

  async restoreSnapshot(data: any, context: CallableContext) {
    const uid = await verifyAuth(context)
    const { projectId, snapshotId } = data

    const snapshotDoc = await db
      .collection('users')
      .doc(uid)
      .collection('projects')
      .doc(projectId)
      .collection('snapshots')
      .doc(snapshotId)
      .get()

    if (!snapshotDoc.exists) {
      throw new functions.https.HttpsError('not-found', 'Snapshot not found')
    }

    const snapshot = snapshotDoc.data()!

    // Restore files
    const projectRef = db.collection('users').doc(uid).collection('projects').doc(projectId)

    // Clear existing files
    const existingFiles = await projectRef.collection('files').get()
    for (const file of existingFiles.docs) {
      await file.ref.delete()
    }

    // Restore snapshot files
    for (const file of snapshot.files) {
      await projectRef.collection('files').doc(file.id).set(file)
    }

    return { success: true }
  },
}
