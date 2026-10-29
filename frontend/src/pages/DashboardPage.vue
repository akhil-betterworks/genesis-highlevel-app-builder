<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { FolderPlus, Loader2, MapPin, MoreHorizontal, Plus, Sparkles, Trash2, FileCode2 } from 'lucide-vue-next'
import AppHeader from '@/components/AppHeader.vue'
import HighLevelCard from '@/components/HighLevelCard.vue'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import Input from '@/components/ui/input/Input.vue'
import Textarea from '@/components/ui/textarea/Textarea.vue'
import Label from '@/components/ui/label/Label.vue'
import Skeleton from '@/components/ui/skeleton/Skeleton.vue'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/api'
import type { Project } from '@/lib/types'
import { timeAgo } from '@/lib/utils'
import { useHighLevel } from '@/composables/useHighLevel'

const route = useRoute()
const router = useRouter()
const hl = useHighLevel()

const projects = ref<Project[]>([])
const loading = ref(true)
const createOpen = ref(false)
const creating = ref(false)
const form = ref({ name: '', description: '' })
const toDelete = ref<Project | null>(null)
const deleting = ref(false)
const menuFor = ref<string | null>(null)

const templates = [
  { name: 'Contact dashboard', description: 'Searchable contact list with upcoming appointments' },
  { name: 'Inbox triage', description: 'Unread conversations with quick replies' },
  { name: 'Booking board', description: 'Calendar availability and appointments by day' },
]

const deleteOpen = computed({
  get: () => !!toDelete.value,
  set: (v) => {
    if (!v) toDelete.value = null
  },
})

async function load() {
  loading.value = true
  try {
    projects.value = (await api.listProjects()).projects
  } catch (e) {
    toast.error('Could not load projects', { description: (e as Error).message })
  } finally {
    loading.value = false
  }
}

async function create() {
  if (!form.value.name.trim()) return
  creating.value = true
  try {
    const { project } = await api.createProject(form.value)
    createOpen.value = false
    form.value = { name: '', description: '' }
    router.push(`/projects/${project.id}`)
  } catch (e) {
    toast.error('Could not create project', { description: (e as Error).message })
  } finally {
    creating.value = false
  }
}

async function confirmDelete() {
  if (!toDelete.value) return
  deleting.value = true
  const p = toDelete.value
  try {
    await api.deleteProject(p.id)
    projects.value = projects.value.filter((x) => x.id !== p.id)
    toast.success(`Deleted “${p.name}”`)
    toDelete.value = null
  } catch (e) {
    toast.error('Delete failed', { description: (e as Error).message })
  } finally {
    deleting.value = false
  }
}

function useTemplate(t: { name: string; description: string }) {
  form.value = { ...t }
  createOpen.value = true
}

onMounted(async () => {
  // Surface the OAuth callback outcome, then clean the URL.
  const status = route.query.hl
  if (status === 'connected') toast.success('HighLevel connected', { description: 'Generated apps can now use your real CRM data.' })
  if (status === 'error') toast.error('HighLevel connection failed', { description: String(route.query.reason ?? 'Unknown error') })
  if (status) router.replace({ query: {} })
  hl.refresh().catch(() => undefined)
  await load()
})
</script>

<template>
  <div class="aurora min-h-screen">
    <AppHeader />
    <main class="mx-auto max-w-6xl space-y-10 px-6 py-10">
      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 class="text-3xl font-bold tracking-tight">Your projects</h1>
          <p class="mt-1 text-muted-foreground">Each project is an app Genesis builds and iterates on with you.</p>
        </div>
        <Button variant="gradient" @click="createOpen = true"><Plus /> New project</Button>
      </div>

      <HighLevelCard />

      <div v-if="loading" class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton v-for="i in 3" :key="i" class="h-40 rounded-xl" />
      </div>

      <div v-else-if="!projects.length" class="glass rounded-2xl px-6 py-14 text-center">
        <div class="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-500/15">
          <FolderPlus class="size-7 text-indigo-300" />
        </div>
        <h3 class="mt-5 text-lg font-semibold">Start your first app</h3>
        <p class="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Pick a starter or create a blank project, then describe what you want.</p>
        <div class="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
          <button
            v-for="t in templates"
            :key="t.name"
            class="rounded-xl border bg-card/60 p-4 text-left transition hover:-translate-y-0.5 hover:border-indigo-400/50"
            @click="useTemplate(t)"
          >
            <Sparkles class="size-4 text-indigo-300" />
            <p class="mt-2 text-sm font-medium">{{ t.name }}</p>
            <p class="mt-1 text-xs text-muted-foreground">{{ t.description }}</p>
          </button>
        </div>
      </div>

      <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card
          v-for="p in projects"
          :key="p.id"
          class="group relative cursor-pointer p-5 transition hover:-translate-y-0.5 hover:border-indigo-400/40 hover:shadow-lg hover:shadow-indigo-500/10"
          @click="router.push(`/projects/${p.id}`)"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="grid size-10 place-items-center rounded-lg bg-gradient-to-br from-indigo-500/25 to-fuchsia-500/25">
              <FileCode2 class="size-5 text-indigo-200" />
            </div>
            <div class="relative" @click.stop>
              <Button variant="ghost" size="icon-sm" aria-label="Project actions" @click="menuFor = menuFor === p.id ? null : p.id">
                <MoreHorizontal />
              </Button>
              <div v-if="menuFor === p.id" class="absolute right-0 z-10 mt-1 w-36 rounded-md border bg-popover p-1 shadow-xl">
                <button
                  class="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
                  @click="(toDelete = p), (menuFor = null)"
                >
                  <Trash2 class="size-4" /> Delete
                </button>
              </div>
            </div>
          </div>
          <h3 class="mt-4 truncate font-semibold">{{ p.name }}</h3>
          <p class="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">{{ p.description || 'No description' }}</p>
          <div class="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">{{ p.fileCount }} files</Badge>
            <Badge v-if="p.hlLocationName" variant="info"><MapPin /> {{ p.hlLocationName }}</Badge>
            <Badge v-if="p.generating" variant="warning"><Loader2 class="animate-spin" /> Generating</Badge>
            <span class="ml-auto">{{ timeAgo(p.updatedAt) }}</span>
          </div>
        </Card>
      </div>
    </main>

    <Dialog v-model:open="createOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New project</DialogTitle>
          <DialogDescription>Give it a name — you’ll describe the app in the chat next.</DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="create">
          <div class="space-y-2">
            <Label for="pname">Name</Label>
            <Input id="pname" v-model="form.name" maxlength="100" required placeholder="Contact dashboard" />
          </div>
          <div class="space-y-2">
            <Label for="pdesc">Description</Label>
            <Textarea id="pdesc" v-model="form.description" maxlength="1000" rows="3" placeholder="What should this app do?" />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" @click="createOpen = false">Cancel</Button>
            <Button type="submit" variant="gradient" :disabled="creating || !form.name.trim()">
              <Loader2 v-if="creating" class="animate-spin" /> Create project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <Dialog v-model:open="deleteOpen">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{{ toDelete?.name }}”?</DialogTitle>
          <DialogDescription>The project will be hidden from your workspace. Its snapshots are retained server-side (soft delete).</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" @click="toDelete = null">Cancel</Button>
          <Button variant="destructive" :disabled="deleting" @click="confirmDelete">
            <Loader2 v-if="deleting" class="animate-spin" /> Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
