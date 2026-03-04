<script setup lang="ts">
import { ref, onMounted, computed, provide } from 'vue'
import { getDashboardStats, type DashboardStats } from '@/api/dashboard'
import { useI18n } from 'vue-i18n'
import { useTheme } from '@/composables/useTheme'
import { useMessage } from 'naive-ui'
import { useRouter } from 'vue-router'

// ECharts
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from 'echarts/components'
import VChart, { THEME_KEY } from 'vue-echarts'

use([
  CanvasRenderer,
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
])

const { t } = useI18n()
const { isDark } = useTheme()
const message = useMessage()
const router = useRouter()

provide(THEME_KEY, computed(() => (isDark.value ? 'dark' : '')))

const loading = ref(true)
const stats = ref<DashboardStats | null>(null)

const fetchStats = async () => {
  loading.value = true
  try {
    const res = await getDashboardStats()
    stats.value = (res as any).data || res
  } catch (error: any) {
    message.error(error.message || 'Failed to fetch dashboard stats')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchStats()
})

// Options for trends chart
const buildTrendsOption = computed(() => {
  if (!stats.value) return {}
  const dates = stats.value.buildTrends.map((i) => i.date.substring(5))
  const success = stats.value.buildTrends.map((i) => i.success)
  const failed = stats.value.buildTrends.map((i) => i.failed)
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: {
      data: ['Success', 'Failed'],
      textStyle: { color: isDark.value ? '#94a3b8' : '#64748b' }
    },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: dates,
      axisLabel: { color: isDark.value ? '#94a3b8' : '#64748b' }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: isDark.value ? '#334155' : '#e2e8f0' } },
      axisLabel: { color: isDark.value ? '#94a3b8' : '#64748b' }
    },
    series: [
      {
        name: 'Success',
        type: 'line',
        smooth: true,
        itemStyle: { color: '#10b981' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.4)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.0)' }
            ]
          }
        },
        data: success
      },
      {
        name: 'Failed',
        type: 'line',
        smooth: true,
        itemStyle: { color: '#ef4444' },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(239, 68, 68, 0.4)' },
              { offset: 1, color: 'rgba(239, 68, 68, 0.0)' }
            ]
          }
        },
        data: failed
      }
    ]
  }
})

// Options for frameworks pie
const frameworkDistOption = computed(() => {
  if (!stats.value) return {}
  const data = stats.value.frameworkDistribution
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    legend: {
      bottom: '5%',
      left: 'center',
      textStyle: { color: isDark.value ? '#94a3b8' : '#64748b' }
    },
    series: [
      {
        name: 'Framework',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: isDark.value ? '#0f172a' : '#ffffff',
          borderWidth: 2
        },
        label: { show: false, position: 'center' },
        emphasis: {
          label: {
            show: true,
            fontSize: 18,
            fontWeight: 'bold',
            color: isDark.value ? '#f8fafc' : '#0f172a'
          }
        },
        labelLine: { show: false },
        data: data.map((i) => ({
          value: i.value,
          name: i.name,
          itemStyle: { color: i.name === 'native' ? '#8b5cf6' : '#3b82f6' }
        }))
      }
    ]
  }
})

// Options for Top Projects bar
const topProjectsOption = computed(() => {
  if (!stats.value) return {}
  const data = stats.value.topProjects.slice().reverse() // Reverse to show top at the top
  return {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: isDark.value ? '#334155' : '#e2e8f0' } },
      axisLabel: { color: isDark.value ? '#94a3b8' : '#64748b' }
    },
    yAxis: {
      type: 'category',
      data: data.map(i => i.name),
      axisLabel: { color: isDark.value ? '#94a3b8' : '#64748b' }
    },
    series: [
      {
        name: 'Builds',
        type: 'bar',
        data: data.map(i => i.buildCount),
        itemStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: '#8b5cf6' },
              { offset: 1, color: '#a855f7' }
            ]
          },
          borderRadius: [0, 4, 4, 0]
        },
        barWidth: '50%'
      }
    ]
  }
})

// Format time utility
const formatTime = (isoStr: string) => {
  const d = new Date(isoStr)
  return `${d.getMonth() + 1}-${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="h-full flex flex-col font-sans">
    <div class="mb-8 animate-fade-in-up" style="animation-duration: 0.6s;">
      <h2 class="text-3xl font-bold tracking-tight text-white" style="font-family: var(--font-fancy, inherit)">
        {{ t('dashboard.title') }}
      </h2>
    </div>

    <div v-if="loading" class="flex-1 flex items-center justify-center min-h-[400px]">
      <div class="flex flex-col items-center gap-4">
        <n-spin size="large" />
        <span class="text-zinc-500">Loading Dashboard Data...</span>
      </div>
    </div>

    <!-- Overview Cards -->
    <div v-else-if="stats" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <!-- Total Projects -->
      <div @click="router.push('/projects')" class="group relative overflow-hidden rounded-2xl p-6 bg-zinc-900 border border-white/5 
        shadow-sm hover:shadow-xl hover:shadow-violet-500/10 dark:hover:shadow-violet-500/20 
        hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-fade-in-up"
        style="animation-delay: 0.1s; animation-fill-mode: both;">
        <div
          class="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        </div>
        <div class="relative z-10">
          <h3
            class="text-sm font-medium text-zinc-500 group-hover:text-violet-400 transition-colors uppercase tracking-wider">
            {{ t('dashboard.totalProjects') }}
          </h3>
          <p class="text-4xl font-light text-white mt-4 tracking-tight group-hover:text-violet-400 transition-colors">
            {{ stats.overview.totalProjects }}
          </p>
        </div>
      </div>

      <!-- Total Users -->
      <div @click="router.push('/admin/users')" class="group relative overflow-hidden rounded-2xl p-6 bg-zinc-900 border border-white/5 
        shadow-sm hover:shadow-xl hover:shadow-blue-500/10 dark:hover:shadow-blue-500/20 
        hover:-translate-y-1 transition-all duration-300 cursor-pointer animate-fade-in-up"
        style="animation-delay: 0.2s; animation-fill-mode: both;">
        <div
          class="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        </div>
        <div class="relative z-10">
          <h3
            class="text-sm font-medium text-zinc-500 group-hover:text-blue-400 transition-colors uppercase tracking-wider">
            {{ t('dashboard.totalUsers') }}
          </h3>
          <p class="text-4xl font-light text-white mt-4 tracking-tight group-hover:text-blue-400 transition-colors">
            {{ stats.overview.totalUsers }}
          </p>
        </div>
      </div>

      <!-- Today's Builds -->
      <div class="group relative overflow-hidden rounded-2xl p-6 bg-zinc-900 border border-white/5 
        shadow-sm hover:shadow-xl hover:shadow-emerald-500/10 dark:hover:shadow-emerald-500/20 
        hover:-translate-y-1 transition-all duration-300 animate-fade-in-up"
        style="animation-delay: 0.3s; animation-fill-mode: both;">
        <div
          class="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        </div>
        <div class="relative z-10">
          <h3
            class="text-sm font-medium text-zinc-500 group-hover:text-emerald-400 transition-colors uppercase tracking-wider">
            {{ t('dashboard.todayBuilds') }}
          </h3>
          <p class="text-4xl font-light text-white mt-4 tracking-tight">
            {{ stats.overview.todayBuilds }}
          </p>
        </div>
      </div>

      <!-- Active Builds -->
      <div class="group relative overflow-hidden rounded-2xl p-6 bg-zinc-900 border border-white/5 
        shadow-sm hover:shadow-xl hover:shadow-amber-500/10 dark:hover:shadow-amber-500/20 
        hover:-translate-y-1 transition-all duration-300 animate-fade-in-up"
        style="animation-delay: 0.4s; animation-fill-mode: both;">
        <div
          class="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        </div>
        <div class="relative z-10">
          <h3
            class="text-sm font-medium text-zinc-500 group-hover:text-amber-400 transition-colors uppercase tracking-wider">
            {{ t('dashboard.activeBuilds') }}
          </h3>
          <div class="flex items-center gap-3 mt-4">
            <div v-if="stats.overview.activeBuilds > 0" class="w-3 h-3 rounded-full bg-amber-500 animate-ping"></div>
            <p class="text-4xl font-light text-amber-500 tracking-tight">
              {{ stats.overview.activeBuilds }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Charts Section -->
    <div v-if="stats" class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <!-- Build Trends -->
      <div
        class="lg:col-span-2 flex flex-col p-6 rounded-2xl bg-zinc-900 border border-white/5 shadow-sm animate-fade-in-up overflow-hidden"
        style="animation-delay: 0.5s; animation-fill-mode: both;">
        <h3 class="text-lg font-medium text-zinc-100 mb-6 shrink-0">{{ t('dashboard.buildTrends') }}
        </h3>
        <div class="relative w-full h-[300px]">
          <v-chart class="absolute inset-0" :option="buildTrendsOption" :theme="isDark ? 'dark' : ''" autoresize />
        </div>
      </div>

      <!-- Framework Distribution -->
      <div
        class="flex flex-col p-6 rounded-2xl bg-zinc-900 border border-white/5 shadow-sm animate-fade-in-up overflow-hidden"
        style="animation-delay: 0.6s; animation-fill-mode: both;">
        <h3 class="text-lg font-medium text-zinc-100 mb-6 shrink-0">{{ t('dashboard.frameworkDist')
        }}</h3>
        <div class="relative w-full h-[300px]">
          <v-chart class="absolute inset-0" :option="frameworkDistOption" :theme="isDark ? 'dark' : ''" autoresize />
        </div>
      </div>
    </div>

    <!-- Third Row Section -->
    <div v-if="stats" class="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-8">
      <!-- Top Projects -->
      <div
        class="flex flex-col p-6 rounded-2xl bg-zinc-900 border border-white/5 shadow-sm animate-fade-in-up overflow-hidden"
        style="animation-delay: 0.7s; animation-fill-mode: both;">
        <h3 class="text-lg font-medium text-zinc-100 mb-6 shrink-0">{{ t('dashboard.topProjects') }}
        </h3>
        <div class="relative w-full h-[350px]">
          <v-chart class="absolute inset-0" :option="topProjectsOption" :theme="isDark ? 'dark' : ''" autoresize />
        </div>
      </div>

      <!-- Recent Activity Feed -->
      <div class="lg:col-span-2 p-6 rounded-2xl bg-zinc-900 border border-white/5 shadow-sm animate-fade-in-up"
        style="animation-delay: 0.8s; animation-fill-mode: both;">
        <h3 class="text-lg font-medium text-zinc-100 mb-6">{{ t('dashboard.recentActivity') }}</h3>

        <div v-if="stats.recentActivity.length === 0" class="flex items-center justify-center h-full pb-10">
          <n-empty :description="t('dashboard.noRecentActivity')" />
        </div>

        <div v-else class="space-y-4">
          <div v-for="item in stats.recentActivity" :key="item.id"
            class="flex items-start gap-4 p-4 rounded-xl hover:bg-white/5 transition-colors group cursor-pointer border border-transparent hover:border-white/10"
            @click="router.push(`/projects/${stats?.topProjects?.find(p => p.name === item.projectName)?.id || ''}`)">

            <div class="mt-1">
              <div v-if="item.status === 'success'"
                class="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
              <div v-else-if="item.status === 'failed'"
                class="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]"></div>
              <div v-else-if="item.status === 'running'"
                class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
              <div v-else class="w-2.5 h-2.5 rounded-full bg-zinc-500"></div>
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-1">
                <span class="font-medium text-zinc-100">{{ item.projectName }}</span>
                <span class="text-xs px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-300">
                  {{ item.branch }}
                </span>
                <span v-if="item.version"
                  :class="isDark ? 'bg-violet-500/20 text-violet-300' : 'bg-violet-100 text-violet-700'">
                  v{{ item.version }}
                </span>
              </div>
              <div class="text-sm text-zinc-500">
                Triggered by <span class="text-zinc-400">{{ item.triggerUser }}</span>
                <span class="mx-2">·</span>
                {{ formatTime(item.createdAt) }}
              </div>
            </div>

            <div class="text-sm font-medium capitalize flex-shrink-0" :class="{
              [isDark ? 'text-emerald-400' : 'text-emerald-600']: item.status === 'success',
              [isDark ? 'text-red-400' : 'text-red-600']: item.status === 'failed',
              [isDark ? 'text-blue-400' : 'text-blue-600']: item.status === 'running',
              'text-zinc-500': !['success', 'failed', 'running'].includes(item.status)
            }">
              {{ item.status }}
            </div>

          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(16px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in-up {
  animation: fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

/* Ensure global font overrides don't break charts */
:deep(.echarts) {
  width: 100%;
  height: 100%;
}
</style>
