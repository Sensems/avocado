<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { getCredentials, createCredential, deleteCredential, testCredential } from '@/api/credential'
import type { CredentialDto } from '@/api/credential'
import { useMessage, useDialog, NTag, NButton } from 'naive-ui'
import { useI18n } from 'vue-i18n'
import { computed } from 'vue'

const message = useMessage()
const dialog = useDialog()
const { t } = useI18n()

const loading = ref(false)
const items = ref<CredentialDto[]>([])
const dialogVisible = ref(false)
const submitting = ref(false)

const form = ref<CredentialDto>({
  name: '',
  type: 'ssh',
  username: '',
  secret: ''
})

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

const columns = computed(() => [
  { title: t('admin.credentials.colName'), key: 'name', minWidth: 150 },
  {
    title: t('admin.credentials.colType'), key: 'type', width: 120, render(row: CredentialDto) {
      return h(NTag, { type: row.type === 'ssh' ? 'warning' : 'primary', size: 'small', bordered: false }, { default: () => row.type?.toUpperCase() })
    }
  },
  {
    title: t('admin.credentials.colActions'), key: 'actions', width: 200, fixed: 'right' as const, render(row: CredentialDto) {
      return h('div', { class: 'flex gap-2' }, [
        h(NButton, { text: true, type: 'primary', size: 'small', onClick: () => handleTest(row.id as string) }, { default: () => t('common.test') }),
        h(NButton, { text: true, type: 'info', size: 'small' }, { default: () => t('common.edit') }),
        h(NButton, { text: true, type: 'error', size: 'small', onClick: () => handleDelete(row.id as string) }, { default: () => t('common.delete') })
      ])
    }
  }
])

const handleCreate = async () => {
  if (!form.value.name) return
  submitting.value = true
  try {
    await createCredential(form.value)
    message.success(t('admin.credentials.added'))
    dialogVisible.value = false
    form.value = { name: '', type: 'ssh', username: '', secret: '' }
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
      <n-button type="primary" @click="dialogVisible = true">{{ t('admin.credentials.addCredential') }}</n-button>
    </div>

    <div class="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
      <n-data-table :columns="columns" :data="items" :loading="loading" :bordered="false" class="dark-table" />
    </div>

    <n-modal v-model:show="dialogVisible" preset="card" :title="t('admin.credentials.dialog.title')"
      class="max-w-[500px]" :bordered="false">
      <n-form>
        <n-form-item :label="t('admin.credentials.dialog.name')" required>
          <n-input v-model:value="form.name" :placeholder="t('admin.credentials.dialog.namePlaceholder')" />
        </n-form-item>
        <n-form-item :label="t('admin.credentials.dialog.protocolType')">
          <n-radio-group v-model:value="form.type" name="protocol-type">
            <n-radio value="ssh">{{ t('admin.credentials.dialog.sshKey') }}</n-radio>
            <n-radio value="https">{{ t('admin.credentials.dialog.https') }}</n-radio>
          </n-radio-group>
        </n-form-item>

        <template v-if="form.type === 'ssh'">
          <n-form-item :label="t('admin.credentials.dialog.privateKey')">
            <n-input v-model:value="form.secret" type="textarea" :rows="4"
              :placeholder="t('admin.credentials.dialog.privateKeyPlaceholder')" />
          </n-form-item>
        </template>
        <template v-else>
          <n-form-item :label="t('admin.credentials.dialog.username')">
            <n-input v-model:value="form.username" />
          </n-form-item>
          <n-form-item :label="t('admin.credentials.dialog.passwordToken')">
            <n-input v-model:value="form.secret" type="password" show-password-on="click" />
          </n-form-item>
        </template>
      </n-form>
      <div class="flex justify-end gap-4 mt-6">
        <n-button @click="dialogVisible = false">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="submitting" @click="handleCreate">{{ t('common.save') }}</n-button>
      </div>
    </n-modal>
  </div>
</template>

<style scoped>
:deep(.n-data-table) {
  background-color: transparent !important;
}
</style>
