<script setup lang="ts">
import { ref, watch } from 'vue'
import { createCredential } from '@/api/credential'
import type { CredentialDto } from '@/api/credential'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  /** 新建成功后携带新记录，供父组件刷新选项并选中 */
  created: [credential: CredentialDto & { id: string }]
}>()

const message = useMessage()
const { t } = useI18n()

const submitting = ref(false)
const form = ref<CredentialDto>({ name: '', type: 'https', username: '', secret: '' })

// 关闭时重置表单，避免下次打开残留
watch(
  () => props.show,
  (visible) => {
    if (!visible) form.value = { name: '', type: 'https', username: '', secret: '' }
  },
)

const handleSubmit = async () => {
  if (!form.value.name) return
  submitting.value = true
  try {
    const res = await createCredential(form.value)
    const created = res.data
    message.success(t('admin.credentials.added'))
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
  <n-modal :show="show" preset="card" :title="t('admin.credentials.dialog.title')" class="max-w-[500px]"
    :bordered="false" @update:show="(v) => emit('update:show', v)">
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
            :placeholder="t('admin.credentials.dialog.privateKeyPlaceholder')" />
        </n-form-item>
      </template>
      <template v-else-if="form.type === 'pat'">
        <n-form-item :label="t('admin.credentials.dialog.patToken')">
          <n-input v-model:value="form.secret" type="password" show-password-on="click"
            :placeholder="t('admin.credentials.dialog.patTokenPlaceholder')" />
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
      <n-button @click="emit('update:show', false)">{{ t('common.cancel') }}</n-button>
      <n-button type="primary" :loading="submitting" @click="handleSubmit">{{ t('common.save') }}</n-button>
    </div>
  </n-modal>
</template>
