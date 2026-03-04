<script setup lang="ts">
import { ref, onMounted, h, computed } from 'vue'
import { getAuditLogs } from '@/api/audit-log'
import type { AuditLogDto } from '@/api/audit-log'
import { format } from 'date-fns'
import { NTag } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const loading = ref(false)
const logs = ref<AuditLogDto[]>([])
const total = ref(0)
const queryParams = ref({
    page: 1,
    limit: 10
})

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

const columns = computed(() => [
    { title: t('admin.auditLogs.colUser'), key: 'username', width: 150 },
    {
        title: t('admin.auditLogs.colAction'), key: 'action', width: 180, render(row: AuditLogDto) {
            return h(NTag, { type: 'info', size: 'small', bordered: false }, { default: () => row.action || t('admin.auditLogs.defaultAction') })
        }
    },
    { title: t('admin.auditLogs.colResource'), key: 'resource', minWidth: 200 },
    { title: t('admin.auditLogs.colIp'), key: 'ipAddress', width: 150 },
    {
        title: t('admin.auditLogs.colTimestamp'), key: 'createdAt', width: 180, render(row: AuditLogDto) {
            return h('span', { class: 'text-zinc-400 text-sm' }, formatDate(row.createdAt))
        }
    }
])

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

onMounted(() => {
    fetchLogs()
})
</script>

<template>
    <div>
        <div class="flex items-center justify-between mb-8">
            <div>
                <h2 class="text-3xl font-bold text-white tracking-tight">{{ t('admin.auditLogs.title') }}</h2>
                <p class="text-zinc-400 mt-1">{{ t('admin.auditLogs.subtitle') }}</p>
            </div>
            <n-button @click="fetchLogs" dashed>{{ t('common.refresh') }}</n-button>
        </div>

        <div class="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl max-w-[1055px]">
            <n-data-table remote :columns="columns" :data="logs" :loading="loading" :bordered="false" class="dark-table"
                :pagination="pagination" />
        </div>
    </div>
</template>

<style scoped>
:deep(.n-data-table) {
    background-color: transparent !important;
}
</style>
