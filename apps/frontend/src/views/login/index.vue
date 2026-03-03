<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '@/store/auth'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const authStore = useAuthStore()
const message = useMessage()
const { t } = useI18n()
const loading = ref(false)

const loginForm = ref({
  username: '',
  password: ''
})

const handleLogin = async () => {
  if (!loginForm.value.username || !loginForm.value.password) {
    message.warning(t('login.validationError'))
    return
  }

  loading.value = true
  try {
    await authStore.login({
      username: loginForm.value.username,
      password: loginForm.value.password
    })
  } catch (error) {
    // Error is handled in axios interceptor and pinia store
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="h-screen w-full flex items-center justify-center bg-zinc-900 overflow-hidden relative">
    <!-- Abstract blurred background art -->
    <div
      class="absolute top-[-10%] left-[-10%] w-96 h-96 bg-violet-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20">
    </div>
    <div
      class="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-fuchsia-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-20">
    </div>

    <div
      class="max-w-md w-full relative z-10 p-8 rounded-3xl bg-zinc-900/40 backdrop-blur-2xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
      <div class="mb-10 text-center">
        <div
          class="w-16 h-16 bg-linear-to-br from-violet-500 to-fuchsia-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
          </svg>
        </div>
        <h2 class="text-3xl font-bold text-white tracking-tight">{{ t('login.title') }}</h2>
        <p class="text-zinc-400 mt-2 font-medium">{{ t('login.subtitle') }}</p>
      </div>

      <n-form @keyup.enter="handleLogin">
        <n-form-item :label="t('login.username')">
          <n-input v-model:value="loginForm.username" :placeholder="t('login.usernamePlaceholder')" size="large" />
        </n-form-item>
        <n-form-item :label="t('login.password')" class="mt-4">
          <n-input v-model:value="loginForm.password" type="password" :placeholder="t('login.passwordPlaceholder')"
            size="large" show-password-on="click" />
        </n-form-item>
        <n-button type="primary" size="large" class="!w-full mt-6 h-12 text-base font-medium" :loading="loading"
          @click="handleLogin">
          {{ t('login.signIn') }}
        </n-button>
      </n-form>

      <p class="text-center text-zinc-500 text-sm mt-8">
        仅限授权人员访问。 <br /> 由 Avocado Auth 保障安全。
      </p>
    </div>
  </div>
</template>

<style scoped></style>
