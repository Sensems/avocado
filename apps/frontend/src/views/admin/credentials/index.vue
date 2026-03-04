<script setup lang="ts">
import { ref, onMounted, h, computed } from 'vue'
import { getCredentials, createCredential, updateCredential, deleteCredential, testCredential } from '@/api/credential'
import type { CredentialDto } from '@/api/credential'
import { useMessage, useDialog, NTag, NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const message = useMessage()
const dialog = useDialog()
const { t } = useI18n()

const loading = ref(false)
const items = ref<CredentialDto[]>([])
const dialogVisible = ref(false)
const submitting = ref(false)
/** 编辑时存储当前记录 id，null 表示新建模式 */
const editingId = ref<string | null>(null)

const emptyForm = (): CredentialDto => ({ name: '', type: 'ssh', username: '', secret: '' })

const form = ref<CredentialDto>(emptyForm())

const dialogTitle = computed(() =>
  editingId.value ? t('admin.credentials.dialog.editTitle') : t('admin.credentials.dialog.title')
)

const fetchItems = async () => {
  loading.value = true
  try {
    const res = await getCredentials()
    items.value = res.data.items || []
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

const openEdit = (row: CredentialDto) => {
  editingId.value = row.id as string
  // 编辑时 secret 字段后端通常不回传，置空让用户选择是否重填
  form.value = { name: row.name, type: row.type, username: row.username ?? '', secret: '' }
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!form.value.name) return
  submitting.value = true
  try {
    if (editingId.value) {
      await updateCredential(editingId.value, form.value)
      message.success(t('admin.credentials.updated'))
    } else {
      await createCredential(form.value)
      message.success(t('admin.credentials.added'))
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
    title: t('admin.credentials.deleteConfirmTitle'),
    content: t('admin.credentials.deleteConfirmContent'),
    positiveText: t('admin.credentials.deleteConfirmOk'),
    negativeText: t('admin.credentials.deleteConfirmCancel'),
    onPositiveClick: async () => {
      try {
        await deleteCredential(id)
        message.success(t('admin.credentials.deleted'))
        fetchItems()
      } catch (e) {
        console.error(e)
      }
    }
  })
}

const handleTest = async (id: string) => {
  try {
    await testCredential(id)
    message.success(t('admin.credentials.testPassed'))
  } catch (e) {
    message.error(t('admin.credentials.testFailed'))
    console.error(e)
  }
}

const columns = computed(() => [
  { title: t('admin.credentials.colName'), key: 'name', minWidth: 150 },
  {
    title: t('admin.credentials.colType'), key: 'type', width: 120, render(row: CredentialDto) {
      let tagType: 'warning' | 'primary' | 'success' = 'primary'
      if (row.type === 'ssh') tagType = 'warning'
      else if (row.type === 'pat') tagType = 'success'
      return h(NTag, { type: tagType, size: 'small', bordered: false }, { default: () => row.type?.toUpperCase() })
    }
  },
  {
    title: t('admin.credentials.colActions'), key: 'actions', width: 200, fixed: 'right' as const, render(row: CredentialDto) {
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
        <h2 class="text-3xl font-bold text-white tracking-tight">{{ t('admin.credentials.title') }}</h2>
        <p class="text-zinc-400 mt-1">{{ t('admin.credentials.subtitle') }}</p>
      </div>
      <n-button type="primary" @click="openCreate">{{ t('admin.credentials.addCredential') }}</n-button>
    </div>

    <div class="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
      <n-data-table :columns="columns" :data="items" :loading="loading" :bordered="false" class="dark-table" />
    </div>

    <n-modal v-model:show="dialogVisible" preset="card" :title="dialogTitle" class="max-w-[500px]" :bordered="false">
      <n-form>
        <n-form-item :label="t('admin.credentials.dialog.name')" required>
          <n-input v-model:value="form.name" :placeholder="t('admin.credentials.dialog.namePlaceholder')" />
        </n-form-item>
        <n-form-item :label="t('admin.credentials.dialog.protocolType')">
          <n-radio-group v-model:value="form.type" name="protocol-type">
            <n-radio value="ssh">{{ t('admin.credentials.dialog.sshKey') }}</n-radio>
            <n-radio value="https">{{ t('admin.credentials.dialog.https') }}</n-radio>
            <n-radio value="pat">{{ t('admin.credentials.dialog.pat') }}</n-radio>
          </n-radio-group>
        </n-form-item>

        <template v-if="form.type === 'ssh'">
          <n-form-item :label="t('admin.credentials.dialog.privateKey')">
            <n-input v-model:value="form.secret" type="textarea" :rows="4"
              :placeholder="editingId ? t('admin.credentials.dialog.privateKeyEditPlaceholder') : t('admin.credentials.dialog.privateKeyPlaceholder')" />
          </n-form-item>
        </template>
        <template v-else-if="form.type === 'pat'">
          <n-form-item :label="t('admin.credentials.dialog.patToken')">
            <n-input v-model:value="form.secret" type="password" show-password-on="click"
              :placeholder="editingId ? t('admin.credentials.dialog.patTokenEditPlaceholder') : t('admin.credentials.dialog.patTokenPlaceholder')" />
          </n-form-item>
        </template>
        <template v-else>
          <n-form-item :label="t('admin.credentials.dialog.username')">
            <n-input v-model:value="form.username" />
          </n-form-item>
          <n-form-item :label="t('admin.credentials.dialog.passwordToken')">
            <n-input v-model:value="form.secret" type="password" show-password-on="click"
              :placeholder="editingId ? t('admin.credentials.dialog.passwordEditPlaceholder') : ''" />
          </n-form-item>
        </template>
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
