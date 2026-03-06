<script setup lang="ts">
import { ref, onMounted, h, computed, inject, type Ref } from 'vue'
import { getAuditLogs } from '@/api/audit-log'
import type { AuditLogDto } from '@/api/audit-log'
import { format } from 'date-fns'
import { NTag, NButton, NDrawer, NDrawerContent } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { useMessage } from 'naive-ui'

const { t } = useI18n()
const message = useMessage()
const isDark = inject<Ref<boolean>>('isDark')!
const loading = ref(false)
const logs = ref<AuditLogDto[]>([])
const total = ref(0)
const queryParams = ref({
    page: 1,
    limit: 10
})

const detailDrawerOpen = ref(false)
const selectedLog = ref<AuditLogDto | null>(null)

const fetchLogs = async () => {
    loading.value = true
    try {
        const res = await getAuditLogs(queryParams.value)
        logs.value = res.data?.items || []
        total.value = res.data?.total || 0
        pagination.value.itemCount = total.value
    } catch (error) {
        console.error(error)
    } finally {
        loading.value = false
    }
}

const pagination = ref({
    page: 1,
    pageSize: 20,
    itemCount: 0,
    onChange: (page: number) => {
        pagination.value.page = page
        queryParams.value.page = page
        fetchLogs()
    }
})

const openDetail = (row: AuditLogDto) => {
    selectedLog.value = row
    detailDrawerOpen.value = true
}

const columns = computed(() => {
    const dark = isDark.value
    return [
    { title: t('admin.auditLogs.colUser'), key: 'username', width: 150 },
    {
        title: t('admin.auditLogs.colAction'), key: 'action', width: 180, render(row: AuditLogDto) {
            return h(NTag, { type: 'info', size: 'small', bordered: false }, { default: () => row.action || t('admin.auditLogs.defaultAction') })
        }
    },
    {
        title: t('admin.auditLogs.colResource'),
        key: 'resource',
        minWidth: 200,
        render(row: AuditLogDto) {
            const val = row.resource ?? row.targetId ?? '-'
            return h('span', { class: dark ? 'text-zinc-300' : 'text-gray-600' }, val)
        }
    },
    { title: t('admin.auditLogs.colIp'), key: 'ipAddress', width: 150 },
    {
        title: t('admin.auditLogs.colTimestamp'), key: 'createdAt', width: 180, render(row: AuditLogDto) {
            return h('span', { class: dark ? 'text-zinc-400 text-sm' : 'text-gray-500 text-sm' }, formatDate(row.createdAt))
        }
    },
    {
        title: t('admin.auditLogs.colOperations'),
        key: 'operations',
        width: 120,
        fixed: 'right' as const,
        render(row: AuditLogDto) {
            return h(NButton, {
                size: 'small',
                text: true,
                type: 'primary',
                class: 'cursor-pointer',
                onClick: () => openDetail(row)
            }, { default: () => t('admin.auditLogs.viewDetail') })
            }
        }
    ]
})

const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    try {
        const d = new Date(dateStr)
        if (isNaN(d.getTime())) return dateStr
        return format(d, 'yyyy-MM-dd HH:mm:ss')
    } catch {
        return dateStr
    }
}

const formatChanges = (changes: unknown): string => {
    if (changes == null) return ''
    if (typeof changes === 'string') {
        try {
            const parsed = JSON.parse(changes)
            return JSON.stringify(parsed, null, 2)
        } catch {
            return changes
        }
    }
    if (typeof changes === 'object') {
        return JSON.stringify(changes, null, 2)
    }
    return String(changes)
}

const copyToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text)
        message.success(t('admin.auditLogs.copySuccess'))
    } catch {
        message.error(t('admin.auditLogs.copyFailed'))
    }
}

onMounted(() => {
    fetchLogs()
})
</script>

<template>
    <div>
        <div class="flex items-center justify-between mb-8">
            <div>
                <h2 :class="['text-3xl font-bold tracking-tight', isDark ? 'text-white' : 'text-gray-900']">{{ t('admin.auditLogs.title') }}</h2>
                <p :class="['mt-1', isDark ? 'text-zinc-400' : 'text-gray-500']">{{ t('admin.auditLogs.subtitle') }}</p>
            </div>
            <n-button @click="fetchLogs" dashed>{{ t('common.refresh') }}</n-button>
        </div>

        <div :class="['border rounded-2xl overflow-hidden shadow-xl max-w-[1055px]', isDark ? 'bg-zinc-900 border-white/5' : 'bg-white border-gray-200']">
            <n-data-table remote :columns="columns" :data="logs" :loading="loading" :bordered="false" class="dark-table"
                :pagination="pagination" />
        </div>

        <!-- Detail Drawer -->
        <n-drawer v-model:show="detailDrawerOpen" :width="600" placement="right"
            @after-leave="selectedLog = null">
            <n-drawer-content :title="t('admin.auditLogs.detailTitle')" closable>
                <div v-if="selectedLog" class="flex flex-col gap-6">
                    <!-- Basic Info -->
                    <section class="flex flex-col gap-3">
                        <h3 :class="['text-sm font-semibold uppercase tracking-wider', isDark ? 'text-zinc-300' : 'text-gray-600']">
                            {{ t('admin.auditLogs.basicInfo') }}
                        </h3>
                        <div :class="['grid gap-3 p-4 rounded-xl border', isDark ? 'bg-zinc-800/60 border-white/5' : 'bg-gray-100 border-gray-200']">
                            <div class="flex justify-between gap-4">
                                <span :class="['text-sm shrink-0', isDark ? 'text-zinc-500' : 'text-gray-500']">{{ t('admin.auditLogs.colUser') }}</span>
                                <span :class="['text-right break-all', isDark ? 'text-white' : 'text-gray-900']">{{ selectedLog.username ?? '-' }}</span>
                            </div>
                            <div class="flex justify-between gap-4">
                                <span :class="['text-sm shrink-0', isDark ? 'text-zinc-500' : 'text-gray-500']">{{ t('admin.auditLogs.colAction') }}</span>
                                <span :class="['text-right break-all', isDark ? 'text-zinc-200' : 'text-gray-700']">{{ selectedLog.action ?? '-' }}</span>
                            </div>
                            <div class="flex justify-between gap-4">
                                <span :class="['text-sm shrink-0', isDark ? 'text-zinc-500' : 'text-gray-500']">{{ t('admin.auditLogs.colResource') }}</span>
                                <span :class="['text-right break-all font-mono text-sm', isDark ? 'text-zinc-200' : 'text-gray-700']">
                                    {{ selectedLog.resource ?? selectedLog.targetId ?? '-' }}
                                </span>
                            </div>
                            <div class="flex justify-between gap-4">
                                <span :class="['text-sm shrink-0', isDark ? 'text-zinc-500' : 'text-gray-500']">{{ t('admin.auditLogs.colIp') }}</span>
                                <span :class="['text-right', isDark ? 'text-zinc-200' : 'text-gray-700']">{{ selectedLog.ipAddress ?? '-' }}</span>
                            </div>
                            <div class="flex justify-between gap-4">
                                <span :class="['text-sm shrink-0', isDark ? 'text-zinc-500' : 'text-gray-500']">{{ t('admin.auditLogs.colTimestamp') }}</span>
                                <span :class="['text-right', isDark ? 'text-zinc-200' : 'text-gray-700']">{{ formatDate(selectedLog.createdAt) }}</span>
                            </div>
                        </div>
                    </section>

                    <!-- Request Info -->
                    <section class="flex flex-col gap-3">
                        <h3 :class="['text-sm font-semibold uppercase tracking-wider', isDark ? 'text-zinc-300' : 'text-gray-600']">
                            {{ t('admin.auditLogs.requestInfo') }}
                        </h3>
                        <div class="flex flex-col gap-3">
                            <div :class="['p-4 rounded-xl border', isDark ? 'bg-zinc-800/60 border-white/5' : 'bg-gray-100 border-gray-200']">
                                <p :class="['text-xs mb-2', isDark ? 'text-zinc-500' : 'text-gray-500']">{{ t('admin.auditLogs.requestUrl') }}</p>
                                <p :class="['font-mono text-sm break-all leading-relaxed', isDark ? 'text-zinc-200' : 'text-gray-700']">
                                    {{ selectedLog.action ?? selectedLog.targetId ?? selectedLog.resource ?? '-' }}
                                </p>
                            </div>
                            <div :class="['p-4 rounded-xl border', isDark ? 'bg-zinc-800/60 border-white/5' : 'bg-gray-100 border-gray-200']">
                                <div class="flex items-center justify-between mb-2">
                                    <p :class="['text-xs', isDark ? 'text-zinc-500' : 'text-gray-500']">{{ t('admin.auditLogs.requestBody') }}</p>
                                    <n-button
                                        v-if="selectedLog.changes != null && formatChanges(selectedLog.changes)"
                                        size="tiny"
                                        tertiary
                                        class="cursor-pointer"
                                        @click="copyToClipboard(formatChanges(selectedLog.changes))"
                                    >
                                        <template #icon>
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </template>
                                        {{ t('admin.auditLogs.copy') }}
                                    </n-button>
                                </div>
                                <pre
                                    v-if="selectedLog.changes != null && formatChanges(selectedLog.changes)"
                                    :class="['text-sm font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap wrap-break-word max-h-64 overflow-y-auto p-3 rounded-lg border', isDark ? 'text-zinc-300 bg-zinc-900/80 border-white/5' : 'text-gray-700 bg-gray-50 border-gray-200']"
                                >{{ formatChanges(selectedLog.changes) }}</pre>
                                <p v-else :class="['text-sm italic', isDark ? 'text-zinc-500' : 'text-gray-500']">{{ t('admin.auditLogs.noRequestBody') }}</p>
                            </div>
                        </div>
                    </section>
                </div>
            </n-drawer-content>
        </n-drawer>
    </div>
</template>

<style scoped>
:deep(.n-data-table) {
    background-color: transparent !important;
}
</style>
