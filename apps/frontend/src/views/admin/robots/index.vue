<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { getRobots, createRobot, deleteRobot, testRobot } from '@/api/robot'
import type { RobotDto } from '@/api/robot'
import { useMessage, useDialog, NTag, NButton } from 'naive-ui'

const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const items = ref<RobotDto[]>([])
const dialogVisible = ref(false)
const submitting = ref(false)

const form = ref<RobotDto>({
  name: '',
  platform: 'wecom',
  webhookUrl: '',
  secret: ''
})

const fetchItems = async () => {
  loading.value = true
  try {
    const res = await getRobots()
    items.value = res.data?.items || []
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

const columns = [
  { title: 'Name', key: 'name', minWidth: 150 },
  {
    title: 'Platform type', key: 'platform', width: 120, render(row: RobotDto) {
      return h(NTag, { type: row.platform === 'wecom' ? 'success' : row.platform === 'dingtalk' ? 'info' : 'warning', size: 'small', bordered: false }, { default: () => row.platform?.toUpperCase() })
    }
  },
  {
    title: 'Actions', key: 'actions', width: 200, fixed: 'right' as const, render(row: RobotDto) {
      return h('div', { class: 'flex gap-2' }, [
        h(NButton, { text: true, type: 'primary', size: 'small', onClick: () => handleTest(row.id as string) }, { default: () => 'Test' }),
        h(NButton, { text: true, type: 'info', size: 'small' }, { default: () => 'Edit' }),
        h(NButton, { text: true, type: 'error', size: 'small', onClick: () => handleDelete(row.id as string) }, { default: () => 'Delete' })
      ])
    }
  }
]

const handleCreate = async () => {
  if (!form.value.name || !form.value.webhookUrl) return
  submitting.value = true
  try {
    await createRobot(form.value)
    message.success('Robot added')
    dialogVisible.value = false
    form.value = { name: '', platform: 'wecom', webhookUrl: '', secret: '' }
    fetchItems()
  } catch (e) {
    console.error(e)
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (id: string) => {
  dialog.warning({
    title: 'Warning',
    content: 'Delete this notification robot?',
    positiveText: 'Delete',
    negativeText: 'Cancel',
    onPositiveClick: async () => {
      try {
        await deleteRobot(id)
        message.success('Deleted successfully')
        fetchItems()
      } catch (e) {
        console.error(e)
      }
    }
  })
}

const handleTest = async (id: string) => {
  try {
    await testRobot(id)
    message.success('Test message sent successfully')
  } catch (e) {
    message.error('Failed to send test message')
    console.error(e)
  }
}

onMounted(() => {
  fetchItems()
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-8">
      <div>
        <h2 class="text-3xl font-bold text-white tracking-tight">IM Notification Robots</h2>
        <p class="text-zinc-400 mt-1">Configure Webhook endpoints for build alerts.</p>
      </div>
      <n-button type="primary" @click="dialogVisible = true">Add Robot</n-button>
    </div>

    <div class="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
      <n-data-table :columns="columns" :data="items" :loading="loading" :bordered="false" class="dark-table" />
    </div>

    <n-modal v-model:show="dialogVisible" preset="card" title="Add IM Robot" class="max-w-[500px]" :bordered="false">
      <n-form>
        <n-form-item label="Robot Name" required>
          <n-input v-model:value="form.name" placeholder="E.g. Prod Build Alerts" />
        </n-form-item>
        <n-form-item label="Platform Type">
          <n-select v-model:value="form.platform"
            :options="[{ label: 'WeCom', value: 'wecom' }, { label: 'DingTalk', value: 'dingtalk' }, { label: 'Feishu / Lark', value: 'feishu' }]" />
        </n-form-item>

        <n-form-item label="Webhook URL" required>
          <n-input v-model:value="form.webhookUrl" placeholder="https://qyapi.weixin.qq.com/cgi-bin/webhook/send..." />
        </n-form-item>

        <n-form-item label="Secret (Optional)">
          <n-input v-model:value="form.secret" placeholder="Used for signature verification" />
        </n-form-item>
      </n-form>
      <div class="flex justify-end gap-4 mt-6">
        <n-button @click="dialogVisible = false">Cancel</n-button>
        <n-button type="primary" :loading="submitting" @click="handleCreate">Save</n-button>
      </div>
    </n-modal>
  </div>
</template>

<style scoped>
:deep(.n-data-table) {
  background-color: transparent !important;
}
</style>
