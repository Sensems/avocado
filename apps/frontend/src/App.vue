<script setup lang="ts">
import Layout from '@/layout/index.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { darkTheme } from 'naive-ui'

const route = useRoute()
const isLogin = computed(() => route.path === '/login')
</script>

<template>
  <n-config-provider :theme="darkTheme">
    <n-loading-bar-provider>
      <n-message-provider>
        <n-notification-provider>
          <n-dialog-provider>
            <template v-if="isLogin">
              <router-view v-slot="{ Component }">
                <transition name="fade-transform" mode="out-in">
                  <component :is="Component" />
                </transition>
              </router-view>
            </template>
            <template v-else>
              <Layout>
                <router-view v-slot="{ Component }">
                  <transition name="fade-transform" mode="out-in">
                    <component :is="Component" />
                  </transition>
                </router-view>
              </Layout>
            </template>
          </n-dialog-provider>
        </n-notification-provider>
      </n-message-provider>
    </n-loading-bar-provider>
  </n-config-provider>
</template>

<style>
/* Global Transition Effect */
.fade-transform-enter-active,
.fade-transform-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.fade-transform-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.fade-transform-leave-to {
  opacity: 0;
  transform: translateX(10px);
}
</style>
