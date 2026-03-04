<script setup lang="ts">
import { inject, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const isDark = inject<Ref<boolean>>('isDark')!
</script>

<template>
    <div class="flex gap-8">
        <aside class="w-56 shrink-0">
            <nav class="flex flex-col gap-1 sticky top-24">
                <router-link v-for="item in [
                    { to: '/admin/users', label: t('admin.nav.users') },
                    { to: '/admin/credentials', label: t('admin.nav.credentials') },
                    { to: '/admin/robots', label: t('admin.nav.robots') },
                    { to: '/admin/audit-logs', label: t('admin.nav.auditLogs') },
                ]" :key="item.to" :to="item.to" class="sidebar-link"
                    :class="isDark ? 'sidebar-link--dark' : 'sidebar-link--light'" active-class="sidebar-link--active">
                    {{ item.label }}
                </router-link>
            </nav>
        </aside>
        <div class="flex-1">
            <router-view />
        </div>
    </div>
</template>

<style scoped>
.sidebar-link {
    position: relative;
    display: flex;
    align-items: center;
    padding: 10px 16px;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    transition: all 0.2s ease;
    /* 激活指示条占位 */
    border-left: 2px solid transparent;
}

/* ── 深色主题默认态 ── */
.sidebar-link--dark {
    color: #a1a1aa;
    /* zinc-400 */
}

.sidebar-link--dark:hover {
    color: #fff;
    background: rgba(255, 255, 255, 0.06);
}

/* ── 浅色主题默认态 ── */
.sidebar-link--light {
    color: #6b7280;
    /* gray-500 */
}

.sidebar-link--light:hover {
    color: #111827;
    background: #f3f4f6;
    /* gray-100 */
}

/* ── 激活态（共用） ── */
.sidebar-link--dark.sidebar-link--active {
    color: #fff;
    background: rgba(255, 255, 255, 0.1);
    border-left-color: #34d399;
    /* emerald-400 */
    font-weight: 600;
}

.sidebar-link--light.sidebar-link--active {
    color: #059669;
    /* emerald-600 */
    background: #ecfdf5;
    /* emerald-50 */
    border-left-color: #10b981;
    /* emerald-500 */
    font-weight: 600;
}
</style>
