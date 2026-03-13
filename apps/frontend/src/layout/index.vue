<script setup lang="ts">
import { computed, inject, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/store/auth'

const { t, locale } = useI18n()
const authStore = useAuthStore()

// 主题
const isDark = inject<Ref<boolean>>('isDark')!
const toggleTheme = inject<() => void>('toggleTheme')!

// 语言切换选项
const langOptions = [
  { label: '🇨🇳 中文', key: 'zh-CN' },
  { label: '🇺🇸 English', key: 'en-US' },
]

const currentLangLabel = computed(() =>
  locale.value === 'zh-CN' ? '中文' : 'EN'
)

const handleLangSelect = (key: string) => {
  locale.value = key
  localStorage.setItem('locale', key)
}

// 退出登录
const userOptions = computed(() => [
  { label: t('common.logout'), key: 'logout' }
])

const handleSelect = (key: string) => {
  if (key === 'logout') {
    authStore.logout()
  }
}
</script>

<template>
  <div :class="[
    'min-h-screen flex flex-col transition-colors duration-300',
    isDark ? 'bg-zinc-950 text-white' : 'bg-gray-50 text-gray-900',
  ]">
    <header :class="[
      'h-16 border-b flex items-center px-6 justify-between backdrop-blur-md sticky top-0 z-50 transition-colors duration-300',
      isDark
        ? 'border-white/5 bg-zinc-900/50'
        : 'border-gray-200 bg-white/80',
    ]">
      <div class="flex items-center gap-4">
        <img src="/logo.png" alt="Logo" class="h-8 w-8" />
        <h1 class="text-xl font-semibold tracking-tight">Avocado CI/CD</h1>
        <nav class="hidden md:flex ml-8 space-x-4">
          <router-link to="/dashboard" :class="[
            'px-3 py-2 rounded-md transition-colors text-sm',
            isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900',
          ]" :active-class="isDark ? 'text-white bg-white/5' : 'text-gray-900 bg-gray-100'">{{ t('nav.dashboard')
          }}</router-link>
          <router-link to="/projects" :class="[
            'px-3 py-2 rounded-md transition-colors text-sm',
            isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900',
          ]" :active-class="isDark ? 'text-white bg-white/5' : 'text-gray-900 bg-gray-100'">{{ t('nav.projects')
          }}</router-link>
          <router-link v-if="authStore.userInfo?.isSuperAdmin" to="/admin" :class="[
            'px-3 py-2 rounded-md transition-colors text-sm',
            isDark ? 'text-zinc-400 hover:text-white' : 'text-gray-500 hover:text-gray-900',
          ]" :active-class="isDark ? 'text-white bg-white/5' : 'text-gray-900 bg-gray-100'">{{ t('nav.admin')
          }}</router-link>
        </nav>
      </div>

      <div class="flex items-center gap-3">
        <!-- 语言切换 -->
        <n-dropdown :options="langOptions" trigger="click" @select="handleLangSelect">
          <n-button text :class="[
            'transition-colors px-2! h-8! text-sm! flex items-center gap-1.5',
            isDark ? 'text-zinc-400! hover:text-white!' : 'text-gray-500! hover:text-gray-900!',
          ]">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            {{ currentLangLabel }}
          </n-button>
        </n-dropdown>

        <!-- 主题切换按钮 -->
        <button :title="isDark ? '切换为亮色模式' : '切换为暗色模式'" :class="[
          'w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200',
          isDark
            ? 'text-zinc-400 hover:text-yellow-300 hover:bg-white/5'
            : 'text-gray-500 hover:text-amber-500 hover:bg-gray-100',
        ]" @click="toggleTheme">
          <!-- 暗色模式：显示太阳图标，点击切换到亮色 -->
          <svg v-if="isDark" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707M17.657 17.657l-.707-.707M6.343 6.343l-.707-.707M12 7a5 5 0 110 10A5 5 0 0112 7z" />
          </svg>
          <!-- 亮色模式：显示月亮图标，点击切换到暗色 -->
          <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
          </svg>
        </button>

        <div :class="['w-px h-4', isDark ? 'bg-white/10' : 'bg-gray-200']"></div>

        <!-- 用户菜单 -->
        <n-dropdown :options="userOptions" @select="handleSelect">
          <span :class="[
            'flex items-center gap-2 cursor-pointer text-sm transition-colors',
            isDark ? 'text-zinc-300 hover:text-white' : 'text-gray-600 hover:text-gray-900',
          ]">
            Admin
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
            </svg>
          </span>
        </n-dropdown>
      </div>
    </header>

    <main class="flex-1 p-8 max-w-7xl mx-auto w-full">
      <router-view />
    </main>
  </div>
</template>

<style scoped></style>
