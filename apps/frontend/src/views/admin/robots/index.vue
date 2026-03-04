<script setup lang="ts">
import { ref, onMounted, h, computed } from 'vue'
import { getRobots, createRobot, updateRobot, deleteRobot, testRobot } from '@/api/robot'
import type { RobotDto } from '@/api/robot'
import { useMessage, useDialog, NTag, NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const message = useMessage()
const dialog = useDialog()
const { t } = useI18n()

const loading = ref(false)
const items = ref<RobotDto[]>([])
const dialogVisible = ref(false)
const submitting = ref(false)
/** 编辑时存储当前记录 id，null 表示新建模式 */
const editingId = ref<string | null>(null)

const emptyForm = (): RobotDto => ({ name: '', platform: 'wecom', webhookUrl: '', secret: '' })

const form = ref<RobotDto>(emptyForm())

const dialogTitle = computed(() =>
  editingId.value ? t('admin.robots.dialog.editTitle') : t('admin.robots.dialog.title')
)

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

const openCreate = () => {
  editingId.value = null
  form.value = emptyForm()
  dialogVisible.value = true
}

const openEdit = (row: RobotDto) => {
  editingId.value = row.id as string
  form.value = { name: row.name, platform: row.platform, webhookUrl: row.webhookUrl, secret: '' }
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!form.value.name || !form.value.webhookUrl) return
  submitting.value = true
  try {
    if (editingId.value) {
      await updateRobot(editingId.value, form.value)
      message.success(t('admin.robots.updated'))
    } else {
      await createRobot(form.value)
      message.success(t('admin.robots.added'))
    }
    dialogVisible.value = false
    form.value = emptyForm()
    fetchItems()
  } catch (e) {
    console.error(e)
  } finally {
    submitting.value = false
  }
}

const handleDelete = async (id: string) => {
  dialog.warning({
    title: t('admin.robots.deleteConfirmTitle'),
    content: t('admin.robots.deleteConfirmContent'),
    positiveText: t('admin.robots.deleteConfirmOk'),
    negativeText: t('admin.robots.deleteConfirmCancel'),
    onPositiveClick: async () => {
      try {
        await deleteRobot(id)
        message.success(t('admin.robots.deleted'))
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
    message.success(t('admin.robots.testSuccess'))
  } catch (e) {
    message.error(t('admin.robots.testFailed'))
    console.error(e)
  }
}

const columns = computed(() => [
  { title: t('admin.robots.colName'), key: 'name', minWidth: 150 },
  {
    title: t('admin.robots.colPlatform'), key: 'platform', width: 120, render(row: RobotDto) {
      return h(NTag, { type: row.platform === 'wecom' ? 'success' : row.platform === 'dingtalk' ? 'info' : 'warning', size: 'small', bordered: false }, { default: () => row.platform?.toUpperCase() })
    }
  },
  {
    title: t('admin.robots.colActions'), key: 'actions', width: 200, fixed: 'right' as const, render(row: RobotDto) {
      return h('div', { class: 'flex gap-2' }, [
        h(NButton, { text: true, type: 'primary', size: 'small', onClick: () => handleTest(row.id as string) }, { default: () => t('common.test') }),
        h(NButton, { text: true, type: 'info', size: 'small', onClick: () => openEdit(row) }, { default: () => t('common.edit') }),
        h(NButton, { text: true, type: 'error', size: 'small', onClick: () => handleDelete(row.id as string) }, { default: () => t('common.delete') })
      ])
    }
  }
])

onMounted(() => {
  fetchItems()
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-8">
      <div>
        <h2 class="text-3xl font-bold text-white tracking-tight">{{ t('admin.robots.title') }}</h2>
        <p class="text-zinc-400 mt-1">{{ t('admin.robots.subtitle') }}</p>
      </div>
      <n-button type="primary" @click="openCreate">{{ t('admin.robots.addRobot') }}</n-button>
    </div>

    <div class="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
      <n-data-table :columns="columns" :data="items" :loading="loading" :bordered="false" class="dark-table" />
    </div>

    <n-modal v-model:show="dialogVisible" preset="card" :title="dialogTitle" class="max-w-[500px]" :bordered="false">
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
          <n-input v-model:value="form.secret"
            :placeholder="editingId ? t('admin.robots.dialog.secretEditPlaceholder') : t('admin.robots.dialog.secretPlaceholder')" />
        </n-form-item>
      </n-form>
      <div class="flex justify-end gap-4 mt-6">
        <n-button @click="dialogVisible = false">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('common.save') }}</n-button>
      </div>
    </n-modal>
  </div>
</template>

<style scoped>
:deep(.n-data-table) {
  background-color: transparent !important;
}
</style>
