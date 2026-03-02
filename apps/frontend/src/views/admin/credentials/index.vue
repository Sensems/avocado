<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { getCredentials, createCredential, deleteCredential, testCredential } from '@/api/credential'
import type { CredentialDto } from '@/api/credential'
import { useMessage, useDialog, NTag, NButton } from 'naive-ui'

const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const items = ref<CredentialDto[]>([])
const dialogVisible = ref(false)
const submitting = ref(false)

const form = ref<CredentialDto>({
  name: '',
  type: 'ssh',
  username: '',
  password: '',
  privateKey: ''
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

const columns = [
  { title: 'Name', key: 'name', minWidth: 150 },
  {
    title: 'Type', key: 'type', width: 120, render(row: CredentialDto) {
      return h(NTag, { type: row.type === 'ssh' ? 'warning' : 'primary', size: 'small', bordered: false }, { default: () => row.type?.toUpperCase() })
    }
  },
  {
    title: 'Actions', key: 'actions', width: 200, fixed: 'right' as const, render(row: CredentialDto) {
      return h('div', { class: 'flex gap-2' }, [
        h(NButton, { text: true, type: 'primary', size: 'small', onClick: () => handleTest(row.id as string) }, { default: () => 'Test' }),
        h(NButton, { text: true, type: 'info', size: 'small' }, { default: () => 'Edit' }),
        h(NButton, { text: true, type: 'error', size: 'small', onClick: () => handleDelete(row.id as string) }, { default: () => 'Delete' })
      ])
    }
  }
]

const handleCreate = async () => {
  if (!form.value.name) return
  submitting.value = true
  try {
    await createCredential(form.value)
    message.success('Credential added')
    dialogVisible.value = false
    form.value = { name: '', type: 'ssh', username: '', password: '', privateKey: '' }
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
    content: 'Are you sure you want to delete this credential?',
    positiveText: 'Delete',
    negativeText: 'Cancel',
    onPositiveClick: async () => {
      try {
        await deleteCredential(id)
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
    await testCredential(id)
    message.success('Connection test passed')
  } catch (e) {
    message.error('Connection test failed')
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
        <h2 class="text-3xl font-bold text-white tracking-tight">Git Credentials</h2>
        <p class="text-zinc-400 mt-1">Manage Git access tokens and SSH keys globally.</p>
      </div>
      <n-button type="primary" @click="dialogVisible = true">Add Credential</n-button>
    </div>

    <div class="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
      <n-data-table :columns="columns" :data="items" :loading="loading" :bordered="false" class="dark-table" />
    </div>

    <n-modal v-model:show="dialogVisible" preset="card" title="Add Git Credential" class="max-w-[500px]"
      :bordered="false">
      <n-form>
        <n-form-item label="Name" required>
          <n-input v-model:value="form.name" placeholder="E.g. Internal GitLab SSH" />
        </n-form-item>
        <n-form-item label="Protocol Type">
          <n-radio-group v-model:value="form.type" name="protocol-type">
            <n-radio value="ssh">SSH Key</n-radio>
            <n-radio value="https">HTTPS</n-radio>
          </n-radio-group>
        </n-form-item>

        <template v-if="form.type === 'ssh'">
          <n-form-item label="Private Key">
            <n-input v-model:value="form.privateKey" type="textarea" :rows="4"
              placeholder="-----BEGIN OPENSSH PRIVATE KEY-----" />
          </n-form-item>
        </template>
        <template v-else>
          <n-form-item label="Username">
            <n-input v-model:value="form.username" />
          </n-form-item>
          <n-form-item label="Password / Token">
            <n-input v-model:value="form.password" type="password" show-password-on="click" />
          </n-form-item>
        </template>
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
