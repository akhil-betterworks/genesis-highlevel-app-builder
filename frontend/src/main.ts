import { createApp } from 'vue'
import { install as VueMonacoEditorPlugin } from '@guolao/vue-monaco-editor'
import 'vue-sonner/style.css'
import './style.css'
import App from './App.vue'
import { router } from './router'

const app = createApp(App)
app.use(router)
app.use(VueMonacoEditorPlugin, {
  paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/min/vs' },
})
app.mount('#app')
