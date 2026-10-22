<template>
  <div class="min-h-screen bg-background">
    <!-- Header -->
    <div class="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div class="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
        <h1 class="text-2xl font-bold">Dashboard</h1>
        <button
          @click="logout"
          class="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition text-sm"
        >
          Logout
        </button>
      </div>
    </div>

    <div class="max-w-7xl mx-auto px-6 py-8">
      <!-- HighLevel Connection Status -->
      <div class="mb-8 p-6 border border-border rounded-lg bg-secondary/50">
        <div class="flex justify-between items-center">
          <div>
            <h2 class="font-semibold mb-1">HighLevel Account</h2>
            <p class="text-muted-foreground text-sm">
              {{ highlevelConnected ? '✅ Connected' : '❌ Not Connected' }}
            </p>
          </div>
          <button
            v-if="!highlevelConnected"
            @click="connectHighLevel"
            :disabled="connectingHL"
            class="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition text-sm"
          >
            {{ connectingHL ? 'Connecting...' : 'Connect Account' }}
          </button>
        </div>
      </div>

      <!-- Projects Section -->
      <div class="mb-8">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-xl font-bold">Your Projects</h2>
          <button
            @click="showCreateProject = true"
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
          >
            + New Project
          </button>
        </div>

        <!-- Projects Grid -->
        <div v-if="projects.length > 0" class="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="project in projects"
            :key="project.id"
            class="border border-border rounded-lg p-6 hover:bg-secondary/50 transition cursor-pointer group"
            @click="() => goToProject(project.id)"
          >
            <h3 class="font-semibold mb-2 group-hover:text-blue-600">{{ project.name }}</h3>
            <p class="text-muted-foreground text-sm mb-4">{{ project.description }}</p>
            <p class="text-xs text-muted-foreground">
              {{ new Date(project.createdAt).toLocaleDateString() }}
            </p>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="text-center py-12 border border-dashed border-border rounded-lg">
          <p class="text-muted-foreground mb-4">No projects yet</p>
          <button
            @click="showCreateProject = true"
            class="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm"
          >
            Create Your First Project
          </button>
        </div>
      </div>
    </div>

    <!-- Create Project Dialog -->
    <div v-if="showCreateProject" class="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg max-w-md w-full p-6">
        <h2 class="text-xl font-bold mb-4">Create New Project</h2>
        <form @submit.prevent="createProject" class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">Project Name</label>
            <input
              v-model="newProject.name"
              type="text"
              required
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">Description</label>
            <textarea
              v-model="newProject.description"
              rows="3"
              class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            ></textarea>
          </div>

          <div class="flex gap-2 justify-end pt-4">
            <button
              type="button"
              @click="showCreateProject = false"
              class="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              :disabled="creatingProject"
              class="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition"
            >
              {{ creatingProject ? 'Creating...' : 'Create' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { logout as authLogout } from '../services/auth'
import {
  getProjects,
  createProject as apiCreateProject,
  getHighLevelOAuthUrl,
  getHighLevelStatus,
} from '../services/api'
import { db } from '../services/firebase'
import { doc, getDoc } from 'firebase/firestore'
import { auth } from '../services/firebase'

const router = useRouter()
const projects = ref<any[]>([])
const showCreateProject = ref(false)
const creatingProject = ref(false)
const connectingHL = ref(false)
const highlevelConnected = ref(false)
const newProject = ref({
  name: '',
  description: '',
})

onMounted(async () => {
  await loadProjects()
  await checkHighLevelConnection()
})

const loadProjects = async () => {
  try {
    const data = await getProjects()
    projects.value = data
  } catch (error) {
    console.error('Failed to load projects:', error)
  }
}

const checkHighLevelConnection = async () => {
  try {
    const status = await getHighLevelStatus()
    highlevelConnected.value = status.connected
  } catch (error) {
    console.error('Failed to check HL status:', error)
  }
}

const createProject = async () => {
  creatingProject.value = true
  try {
    await apiCreateProject({
      name: newProject.value.name,
      description: newProject.value.description,
      highlevelLocationId: '',
    })
    showCreateProject.value = false
    newProject.value = { name: '', description: '' }
    await loadProjects()
  } catch (error) {
    console.error('Failed to create project:', error)
  } finally {
    creatingProject.value = false
  }
}

const connectHighLevel = async () => {
  connectingHL.value = true
  try {
    const { url } = await getHighLevelOAuthUrl()
    window.location.href = url
  } catch (error) {
    console.error('Failed to get OAuth URL:', error)
    connectingHL.value = false
  }
}

const goToProject = (projectId: string) => {
  router.push(`/project/${projectId}`)
}

const logout = async () => {
  try {
    await authLogout()
    router.push('/login')
  } catch (error) {
    console.error('Failed to logout:', error)
  }
}
</script>
