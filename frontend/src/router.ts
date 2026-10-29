import { createRouter, createWebHistory } from 'vue-router'
import { useAuth, waitForAuth } from '@/composables/useAuth'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: () => import('@/pages/HomePage.vue'), meta: { guestOnly: true } },
    { path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { guestOnly: true } },
    { path: '/signup', name: 'signup', component: () => import('@/pages/SignupPage.vue'), meta: { guestOnly: true } },
    { path: '/dashboard', name: 'dashboard', component: () => import('@/pages/DashboardPage.vue'), meta: { auth: true } },
    { path: '/projects/:id', name: 'workspace', component: () => import('@/pages/WorkspacePage.vue'), meta: { auth: true }, props: true },
    { path: '/oauth/callback', name: 'oauth-callback', component: () => import('@/pages/OAuthCallbackPage.vue') },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue') },
  ],
})

router.beforeEach(async (to) => {
  await waitForAuth()
  const { isAuthed } = useAuth()
  if (to.meta.auth && !isAuthed.value) return { name: 'login', query: { redirect: to.fullPath } }
  if (to.meta.guestOnly && isAuthed.value) return { name: 'dashboard' }
  return true
})
