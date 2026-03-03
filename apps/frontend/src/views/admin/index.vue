<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
</script>

<template>
    <div class="flex gap-8">
        <aside class="w-64 shrink-0">
            <nav class="flex flex-col gap-2 sticky top-24">
                <router-link to="/admin/users"
                    class="px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-zinc-400"
                    active-class="bg-white/5 text-white font-medium">{{ t('admin.nav.users') }}</router-link>
                <router-link to="/admin/credentials"
                    class="px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-zinc-400"
                    active-class="bg-white/5 text-white font-medium">{{ t('admin.nav.credentials') }}</router-link>
                <router-link to="/admin/robots"
                    class="px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-zinc-400"
                    active-class="bg-white/5 text-white font-medium">{{ t('admin.nav.robots') }}</router-link>
                <router-link to="/admin/audit-logs"
                    class="px-4 py-3 rounded-xl hover:bg-white/5 transition-colors text-zinc-400"
                    active-class="bg-white/5 text-white font-medium">{{ t('admin.nav.auditLogs') }}</router-link>
            </nav>
        </aside>
        <div class="flex-1">
            <router-view />
        </div>
    </div>
</template>

<style scoped></style>
