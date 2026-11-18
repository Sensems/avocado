<script setup lang="ts">
import { ref, watch } from 'vue'
import { createRobot } from '@/api/robot'
import type { RobotDto } from '@/api/robot'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  /** 新建成功后携带新记录，供父组件刷新选项并选中 */
  created: [robot: RobotDto & { id: string }]
}>()

const message = useMessage()
const { t } = useI18n()

const submitting = ref(false)
const form = ref<RobotDto>({ name: '', platform: 'wecom', webhookUrl: '', secretToken: '' })

watch(
  () => props.show,
  (visible) => {
    if (!visible) form.value = { name: '', platform: 'wecom', webhookUrl: '', secretToken: '' }
  },
)

const handleSubmit = async () => {
  if (!form.value.name || !form.value.webhookUrl) return
  submitting.value = true
  try {
    const res = await createRobot(form.value)
    const created = res.data
    message.success(t('admin.robots.added'))
    emit('created', created)
    emit('update:show', false)
  } catch (e) {
    console.error(e)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <n-modal :show="show" preset="card" :title="t('admin.robots.dialog.title')" class="max-w-[500px]"
    :bordered="false" @update:show="(v) => emit('update:show', v)">
    <n-form>
      <n-form-item :label="t('admin.robots.dialog.name')" required>
        <n-input v-model:value="form.name" :placeholder="t('admin.robots.dialog.namePlaceholder')" />
      </n-form-item>
      <n-form-item :label="t('admin.robots.dialog.platform')">
        <n-select v-model:value="form.platform" :options="[
          { label: t('admin.robots.platforms.wecom'), value: 'wecom' },
          { label: t('admin.robots.platforms.dingtalk'), value: 'dingtalk' },
          { label: t('admin.robots.platforms.feishu'), value: 'feishu' }
        ]" />
      </n-form-item>
      <n-form-item :label="t('admin.robots.dialog.webhookUrl')" required>
        <n-input v-model:value="form.webhookUrl" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send..." />
      </n-form-item>
      <n-form-item :label="t('admin.robots.dialog.secret')">
        <n-input v-model:value="form.secretToken" :placeholder="t('admin.robots.dialog.secretPlaceholder')" />
      </n-form-item>
    </n-form>
    <div class="flex justify-end gap-4 mt-6">
      <n-button @click="emit('update:show', false)">{{ t('common.cancel') }}</n-button>
      <n-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('common.save') }}</n-button>
    </div>
  </n-modal>
</template>
