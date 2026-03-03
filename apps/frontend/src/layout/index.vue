<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import i18n from '@/i18n'

const router = useRouter()
const { t, locale } = useI18n()

// 语言切换选项
const langOptions = [
  {
    label: '🇨🇳 中文',
    key: 'zh-CN',
  },
  {
    label: '🇺🇸 English',
    key: 'en-US',
  },
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
    router.push('/login')
  }
}
</script>

<template>
  <div class="min-h-screen bg-zinc-950 text-white flex flex-col">
    <header
      class="h-16 border-b border-white/5 flex items-center px-6 justify-between bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
      <div class="flex items-center gap-4">
        <h1 class="text-xl font-semibold tracking-tight">Avocado CI/CD</h1>
        <nav class="hidden md:flex ml-8 space-x-4">
          <router-link to="/dashboard" class="text-zinc-400 hover:text-white px-3 py-2 rounded-md transition-colors"
            active-class="text-white bg-white/5">{{ t('nav.dashboard') }}</router-link>
          <router-link to="/projects" class="text-zinc-400 hover:text-white px-3 py-2 rounded-md transition-colors"
            active-class="text-white bg-white/5">{{ t('nav.projects') }}</router-link>
          <router-link to="/admin" class="text-zinc-400 hover:text-white px-3 py-2 rounded-md transition-colors"
            active-class="text-white bg-white/5">{{ t('nav.admin') }}</router-link>
        </nav>
      </div>

      <div class="flex items-center gap-3">
        <!-- 语言切换 -->
        <n-dropdown :options="langOptions" trigger="click" @select="handleLangSelect">
          <n-button text
            class="!text-zinc-400 hover:!text-white transition-colors !px-2 !h-8 !text-sm flex items-center gap-1.5">
            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            {{ currentLangLabel }}
          </n-button>
        </n-dropdown>

        <div class="w-px h-4 bg-white/10"></div>

        <!-- 用户菜单 -->
        <n-dropdown :options="userOptions" @select="handleSelect">
          <span class="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 hover:text-white transition-colors">
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
