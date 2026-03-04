<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const { t } = useI18n()
</script>

<template>
    <div class="h-screen flex items-center justify-center bg-zinc-950 text-white">
        <div class="text-center">
            <h1 class="text-6xl font-bold mb-4">403</h1>
            <p class="text-2xl text-zinc-400 mb-8">{{ t('common.forbidden', '您没有权限访问此页面') }}</p>
            <n-button type="primary" size="large" @click="router.push('/dashboard')">
                {{ t('common.backToHome', '返回首页') }}
            </n-button>
        </div>
    </div>
</template>

<style scoped></style>
