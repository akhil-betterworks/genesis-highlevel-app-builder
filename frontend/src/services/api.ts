import axios from 'axios'
import { auth } from './firebase'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001/highlevel-app-builder/us-central1'

export const apiClient = axios.create({
  baseURL: API_BASE,
})

// Add auth token to all requests
apiClient.interceptors.request.use(async (config) => {
  if (auth.currentUser) {
    const token = await auth.currentUser.getIdToken()
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Project APIs
export async function createProject(data: {
  name: string
  description: string
  highlevelLocationId: string
}) {
  const response = await apiClient.post('/projects', data)
  return response.data
}

export async function getProjects() {
  const response = await apiClient.get('/projects')
  return response.data
}

export async function getProject(projectId: string) {
  const response = await apiClient.get(`/projects/${projectId}`)
  return response.data
}

export async function updateProject(
  projectId: string,
  data: Record<string, any>
) {
  const response = await apiClient.put(`/projects/${projectId}`, data)
  return response.data
}

export async function deleteProject(projectId: string) {
  await apiClient.delete(`/projects/${projectId}`)
}

// File APIs
export async function getProjectFiles(projectId: string) {
  const response = await apiClient.get(`/projects/${projectId}/files`)
  return response.data
}

export async function getFile(projectId: string, fileId: string) {
  const response = await apiClient.get(`/projects/${projectId}/files/${fileId}`)
  return response.data
}

export async function saveFile(
  projectId: string,
  fileId: string,
  content: string
) {
  const response = await apiClient.put(
    `/projects/${projectId}/files/${fileId}`,
    { content }
  )
  return response.data
}

// Generation APIs with SSE
export async function generateCode(
  projectId: string,
  prompt: string,
  onChunk: (data: string) => void,
  onError: (error: Error) => void
) {
  const token = await auth.currentUser?.getIdToken()
  const eventSource = new EventSource(
    `${API_BASE}/projects/${projectId}/generate?prompt=${encodeURIComponent(
      prompt
    )}&token=${token}`
  )

  eventSource.addEventListener('token', (event: Event) => {
    const customEvent = event as MessageEvent
    onChunk(customEvent.data)
  })

  eventSource.addEventListener('error', () => {
    eventSource.close()
    onError(new Error('Generation failed'))
  })

  eventSource.addEventListener('done', () => {
    eventSource.close()
  })

  return eventSource
}

// Snapshot APIs
export async function getSnapshots(projectId: string) {
  const response = await apiClient.get(`/projects/${projectId}/snapshots`)
  return response.data
}

export async function restoreSnapshot(projectId: string, snapshotId: string) {
  const response = await apiClient.post(
    `/projects/${projectId}/snapshots/${snapshotId}/restore`
  )
  return response.data
}

// HighLevel OAuth
export async function getHighLevelOAuthUrl() {
  const response = await apiClient.get('/oauth/url')
  return response.data
}

export async function getHighLevelStatus() {
  const response = await apiClient.get('/oauth/status')
  return response.data
}
