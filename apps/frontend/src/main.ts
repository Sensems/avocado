import { createApp } from 'vue'
import { createPinia } from 'pinia'
import naive from 'naive-ui'
// General Font
import 'vfonts/Inter.css'
// Monospace Font
import 'vfonts/FiraCode.css'

import './style.css'
import App from '@/App.vue'
import router from '@/router'
import i18n from '@/i18n'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(naive)
app.use(i18n)

app.mount('#app')
