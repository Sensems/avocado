<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
const options = [
  { label: 'Logout', key: 'logout' }
]

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
            active-class="text-white bg-white/5">Dashboard</router-link>
          <router-link to="/projects" class="text-zinc-400 hover:text-white px-3 py-2 rounded-md transition-colors"
            active-class="text-white bg-white/5">Projects</router-link>
          <router-link to="/admin" class="text-zinc-400 hover:text-white px-3 py-2 rounded-md transition-colors"
            active-class="text-white bg-white/5">Admin</router-link>
        </nav>
      </div>
      <div class="flex items-center gap-4">
        <n-dropdown :options="options" @select="handleSelect">
          <span class="flex items-center gap-2 cursor-pointer text-sm text-zinc-300 hover:text-white transition-colors">
            Admin <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
