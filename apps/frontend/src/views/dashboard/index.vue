<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getProjects } from '@/api/project'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const projectCount = ref(0)
const loading = ref(false)

const fetchStats = async () => {
  loading.value = true
  try {
    const res = await getProjects()
    projectCount.value = res.data?.total || res.data?.items?.length || 0
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchStats()
})
</script>

<template>
  <div>
    <h2 class="text-3xl font-bold mb-8 text-white tracking-tight">{{ t('dashboard.title') }}</h2>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div @click="$router.push('/projects')"
        class="p-6 rounded-2xl bg-zinc-900 border border-white/5 hover:border-violet-500/50 hover:shadow-[0_0_30px_rgba(139,92,246,0.15)] transition-all cursor-pointer group">
        <h3 class="text-xl font-medium text-zinc-100 group-hover:text-white transition-colors">{{
          t('dashboard.activeProjects') }}</h3>
        <p class="text-4xl font-light text-zinc-300 mt-4 group-hover:text-violet-400 transition-colors">12</p>
      </div>

      <div
        class="p-6 rounded-2xl bg-zinc-900 border border-white/5 hover:border-white/20 transition-colors cursor-pointer group">
        <h3 class="text-xl font-medium text-zinc-100 group-hover:text-white transition-colors">{{
          t('dashboard.runningBuilds') }}</h3>
        <p class="text-4xl font-light text-blue-400 mt-4">3</p>
      </div>

      <div
        class="p-6 rounded-2xl bg-zinc-900 border border-white/5 hover:border-white/20 transition-colors cursor-pointer group">
        <h3 class="text-xl font-medium text-zinc-100 group-hover:text-white transition-colors">{{
          t('dashboard.failedBuilds24h') }}</h3>
        <p class="text-4xl font-light text-red-400 mt-4">1</p>
      </div>
    </div>
  </div>
</template>

<style scoped></style>
