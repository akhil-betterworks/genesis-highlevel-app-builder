import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import { setupAuth } from './services/auth'

const app = createApp(App)

const routes = [
  { path: '/', component: () => import('./pages/Home.vue') },
  { path: '/login', component: () => import('./pages/Login.vue') },
  { path: '/signup', component: () => import('./pages/Signup.vue') },
  { path: '/dashboard', component: () => import('./pages/Dashboard.vue'), meta: { requiresAuth: true } },
  { path: '/project/:id', component: () => import('./pages/ProjectEditor.vue'), meta: { requiresAuth: true } },
  { path: '/oauth/callback', component: () => import('./pages/OAuthCallback.vue'), meta: { requiresAuth: true } },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth)
  const currentUser = localStorage.getItem('authUser')

  if (requiresAuth && !currentUser) {
    next('/login')
  } else if ((to.path === '/login' || to.path === '/signup') && currentUser) {
    next('/dashboard')
  } else {
    next()
  }
})

setupAuth()
app.use(router)
app.mount('#app')
