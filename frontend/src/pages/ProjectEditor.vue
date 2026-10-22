<template>
  <div class="h-screen flex flex-col bg-background">
    <!-- Header -->
    <div class="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-6 py-3">
      <div class="flex justify-between items-center">
        <div class="flex items-center gap-2">
          <button @click="router.back()" class="text-muted-foreground hover:text-foreground">
            ← Back
          </button>
          <h1 class="text-lg font-semibold">{{ project?.name }}</h1>
        </div>
        <div class="flex gap-2">
          <button
            v-if="snapshots.length > 0"
            @click="showSnapshots = true"
            class="px-3 py-1 text-sm border border-border rounded-lg hover:bg-secondary transition"
          >
            📷 Snapshots
          </button>
          <button
            @click="router.push('/dashboard')"
            class="px-3 py-1 text-sm bg-secondary hover:bg-secondary/80 rounded-lg transition"
          >
            Dashboard
          </button>
        </div>
      </div>
    </div>

    <!-- Main Workspace -->
    <div class="flex-1 flex overflow-hidden">
      <!-- Chat Panel -->
      <div class="w-80 border-r border-border flex flex-col bg-secondary/30">
        <div class="flex-1 overflow-y-auto p-4 space-y-4">
          <div
            v-for="message in messages"
            :key="message.id"
            :class="[
              'p-3 rounded-lg max-w-xs',
              message.role === 'user'
                ? 'bg-blue-600 text-white ml-auto'
                : 'bg-muted text-foreground mr-auto',
            ]"
          >
            <p class="text-sm">{{ message.content }}</p>
            <p class="text-xs opacity-70 mt-1">
              {{ new Date(message.timestamp).toLocaleTimeString() }}
            </p>
          </div>
        </div>

        <!-- Input -->
        <div class="border-t border-border p-4">
          <form @submit.prevent="sendPrompt" class="space-y-2">
            <textarea
              v-model="userPrompt"
              :disabled="generating"
              placeholder="Describe what you want to build..."
              rows="3"
              class="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
            ></textarea>
            <button
              type="submit"
              :disabled="generating || !userPrompt.trim()"
              class="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition"
            >
              {{ generating ? 'Generating...' : 'Generate' }}
            </button>
            <button
              v-if="generating"
              type="button"
              @click="cancelGeneration"
              class="w-full px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition"
            >
              Cancel
            </button>
          </form>
        </div>
      </div>

      <!-- Code Editor -->
      <div class="flex-1 flex flex-col border-r border-border">
        <!-- File Tabs -->
        <div class="flex items-center gap-2 border-b border-border px-4 py-2 overflow-x-auto bg-secondary/20">
          <div
            v-for="file in files"
            :key="file.id"
            @click="currentFile = file.id"
            :class="[
              'px-3 py-1 text-sm cursor-pointer rounded-t-lg transition whitespace-nowrap',
              currentFile === file.id
                ? 'bg-background border-t-2 border-blue-500'
                : 'text-muted-foreground hover:bg-background/50',
            ]"
          >
            {{ file.name }}
          </div>
        </div>

        <!-- Editor -->
        <div class="flex-1 overflow-hidden">
          <MonacoEditor
            v-if="currentFileContent !== null"
            :value="currentFileContent"
            language="typescript"
            :options="editorOptions"
            @change="updateFileContent"
            class="h-full"
          />
          <div v-else class="flex items-center justify-center h-full text-muted-foreground">
            Select a file to edit
          </div>
        </div>
      </div>

      <!-- Live Preview -->
      <div class="w-96 flex flex-col border-l border-border bg-background">
        <div class="border-b border-border px-4 py-3 flex justify-between items-center">
          <h3 class="font-semibold text-sm">Preview</h3>
          <button
            @click="refreshPreview"
            class="px-2 py-1 text-xs bg-secondary hover:bg-secondary/80 rounded transition"
          >
            🔄 Refresh
          </button>
        </div>

        <iframe
          ref="previewIframe"
          class="flex-1 border-0"
          sandbox="allow-scripts allow-same-origin allow-forms"
          title="Live Preview"
        ></iframe>
      </div>
    </div>

    <!-- Snapshots Dialog -->
    <div v-if="showSnapshots" class="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
      <div class="bg-white rounded-lg max-w-md w-full p-6">
        <h2 class="text-lg font-bold mb-4">Snapshots</h2>
        <div class="space-y-2 max-h-96 overflow-y-auto">
          <div
            v-for="snapshot in snapshots"
            :key="snapshot.id"
            class="border border-gray-200 rounded-lg p-3 flex justify-between items-center"
          >
            <div class="flex-1">
              <p class="text-sm font-medium">
                {{ new Date(snapshot.timestamp).toLocaleString() }}
              </p>
            </div>
            <button
              @click="restoreSnapshot(snapshot.id)"
              class="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded transition"
            >
              Restore
            </button>
          </div>
        </div>
        <button
          @click="showSnapshots = false"
          class="w-full mt-4 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          Close
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import MonacoEditor from '@guolao/vue-monaco-editor'
import {
  getProject,
  getProjectFiles,
  generateCode,
  getSnapshots as apiGetSnapshots,
  restoreSnapshot as apiRestoreSnapshot,
} from '../services/api'

const router = useRouter()
const route = useRoute()
const projectId = route.params.id as string

const project = ref<any>(null)
const files = ref<any[]>([])
const messages = ref<any[]>([])
const snapshots = ref<any[]>([])
const currentFile = ref<string>('')
const currentFileContent = ref<string | null>(null)
const userPrompt = ref('')
const generating = ref(false)
const showSnapshots = ref(false)
let generationEventSource: EventSource | null = null

const editorOptions = {
  automaticLayout: true,
  minimap: { enabled: false },
  fontSize: 13,
  lineNumbers: 'on',
  tabSize: 2,
  wordWrap: 'on',
}

const currentFileObj = computed(() =>
  files.value.find(f => f.id === currentFile.value)
)

onMounted(async () => {
  try {
    project.value = await getProject(projectId)
    const filesData = await getProjectFiles(projectId)
    files.value = filesData

    // Get snapshots
    snapshots.value = await apiGetSnapshots(projectId)

    // Set current file
    if (files.value.length > 0) {
      currentFile.value = files.value[0].id
      currentFileContent.value = files.value[0].content
    }
  } catch (error) {
    console.error('Failed to load project:', error)
    router.push('/dashboard')
  }
})

const updateFileContent = (newContent: string) => {
  currentFileContent.value = newContent
  // Auto-save debounced
}

const sendPrompt = () => {
  if (!userPrompt.value.trim()) return

  // Add user message
  messages.value.push({
    id: Date.now().toString(),
    role: 'user',
    content: userPrompt.value,
    timestamp: new Date(),
  })

  const prompt = userPrompt.value
  userPrompt.value = ''
  generating.value = true

  let assistantMessage = {
    id: (Date.now() + 1).toString(),
    role: 'assistant',
    content: '',
    timestamp: new Date(),
  }
  messages.value.push(assistantMessage)

  const onChunk = (chunk: string) => {
    assistantMessage.content += chunk
  }

  const onError = (error: Error) => {
    assistantMessage.content += `\n\n❌ Error: ${error.message}`
    generating.value = false
  }

  generationEventSource = generateCode(projectId, prompt, onChunk, onError)
}

const cancelGeneration = () => {
  if (generationEventSource) {
    generationEventSource.close()
    generationEventSource = null
  }
  generating.value = false
}

const refreshPreview = () => {
  if (previewIframe.value) {
    previewIframe.value.src = previewIframe.value.src
  }
}

const restoreSnapshot = async (snapshotId: string) => {
  try {
    await apiRestoreSnapshot(projectId, snapshotId)
    showSnapshots.value = false
    window.location.reload()
  } catch (error) {
    console.error('Failed to restore snapshot:', error)
  }
}

const previewIframe = ref<HTMLIFrameElement | null>(null)
</script>
