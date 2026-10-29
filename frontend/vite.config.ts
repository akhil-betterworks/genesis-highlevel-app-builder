/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const projectId = env.VITE_FIREBASE_PROJECT_ID
  const functionsBase = `http://127.0.0.1:5001/${projectId}/us-central1`

  return {
    plugins: [vue()],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      port: 3000,
      strictPort: true,
      // Mirrors the Firebase Hosting rewrites so the SPA always calls same-origin `/api/**`.
      proxy: {
        // Long-lived SSE generation streams: never time out at the dev proxy.
        '/api': { target: functionsBase, changeOrigin: true, timeout: 0, proxyTimeout: 0 },
        '/oauth/callback': { target: functionsBase, changeOrigin: true, rewrite: (p) => p.replace(/^\/oauth\/callback/, '/oauthCallback') },
      },
    },
    build: {
      outDir: 'dist',
      target: 'es2022',
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        output: {
          manualChunks: {
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
            vue: ['vue', 'vue-router'],
          },
        },
      },
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.ts'],
    },
  }
})
