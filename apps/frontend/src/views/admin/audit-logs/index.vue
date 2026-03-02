<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { getAuditLogs } from '@/api/audit-log'
import type { AuditLogDto } from '@/api/audit-log'
import { format } from 'date-fns'
import { NTag } from 'naive-ui'

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

const columns = [
    { title: 'User', key: 'username', width: 150 },
    {
        title: 'Action', key: 'action', width: 180, render(row: AuditLogDto) {
            return h(NTag, { type: 'info', size: 'small', bordered: false }, { default: () => row.action || 'Sys Action' })
        }
    },
    { title: 'Target Resource', key: 'resource', minWidth: 200 },
    { title: 'IP Address', key: 'ipAddress', width: 150 },
    {
        title: 'Timestamp', key: 'createdAt', width: 180, render(row: AuditLogDto) {
            return h('span', { class: 'text-zinc-400 text-sm' }, formatDate(row.createdAt))
        }
    }
]

// Removed handlePageChange since it's merged mechanically

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
                <h2 class="text-3xl font-bold text-white tracking-tight">Audit Logs</h2>
                <p class="text-zinc-400 mt-1">Review system-wide actions and security events.</p>
            </div>
            <n-button @click="fetchLogs" dashed>Refresh</n-button>
        </div>

        <div class="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
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
