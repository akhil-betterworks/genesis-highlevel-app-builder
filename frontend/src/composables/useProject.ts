import { ref, computed } from 'vue'
import { getProject, getProjectFiles, saveFile } from '../services/api'
import type { Ref } from 'vue'

export interface ProjectFile {
  id: string
  name: string
  type: string
  content: string
  createdAt: Date
  updatedAt: Date
}

export interface Project {
  id: string
  name: string
  description: string
  createdAt: Date
  highlevelLocationId: string
}

export function useProject(projectId: string) {
  const project: Ref<Project | null> = ref(null)
  const files: Ref<ProjectFile[]> = ref([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function loadProject() {
    try {
      loading.value = true
      project.value = await getProject(projectId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load project'
    }
  }

  async function loadFiles() {
    try {
      files.value = await getProjectFiles(projectId)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load files'
    } finally {
      loading.value = false
    }
  }

  async function updateFile(fileId: string, content: string) {
    try {
      await saveFile(projectId, fileId, content)

      // Update local state
      const fileIndex = files.value.findIndex(f => f.id === fileId)
      if (fileIndex >= 0) {
        files.value[fileIndex].content = content
        files.value[fileIndex].updatedAt = new Date()
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to save file'
      throw err
    }
  }

  const fileTree = computed(() => {
    return files.value.reduce(
      (acc, file) => {
        const ext = file.name.split('.').pop()
        if (!acc[ext]) acc[ext] = []
        acc[ext].push(file)
        return acc
      },
      {} as Record<string, ProjectFile[]>
    )
  })

  return {
    project,
    files,
    fileTree,
    loading,
    error,
    loadProject,
    loadFiles,
    updateFile,
  }
}
