<script setup lang="ts">
import { ref, onMounted, h } from 'vue'
import { getUsers, updateUserStatus, createUser, updateUser, deleteUser } from '@/api/user'
import type { UserDto } from '@/api/user'
import { useMessage, useDialog, NTag, NSwitch, NButton } from 'naive-ui'

const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const users = ref<UserDto[]>([])
const dialogVisible = ref(false)
const submitting = ref(false)
const dialogType = ref<'add' | 'edit'>('add')
const currentUserId = ref<string>('')
const pagination = ref({ page: 1, pageSize: 15, itemCount: 0, onChange: (page: number) => { pagination.value.page = page; fetchUsers() } })

const userForm = ref<UserDto>({
    username: '',
    password: '',
    isSuperAdmin: false
})

const fetchUsers = async () => {
    loading.value = true
    try {
        const res = await getUsers(pagination.value.page, pagination.value.pageSize)
        users.value = res.data.items || []
        pagination.value.itemCount = res.total || 0
    } catch (error) {
        console.error(error)
    } finally {
        loading.value = false
    }
}

const columns = [
    { title: 'Username', key: 'username', minWidth: 150 },
    {
        title: 'Role', key: 'role', width: 150, render(row: UserDto) {
            return h(NTag, { type: row.isSuperAdmin ? 'error' : 'info', size: 'small', bordered: false }, { default: () => row.isSuperAdmin ? 'Super Admin' : 'User' })
        }
    },
    {
        title: 'Status', key: 'status', width: 100, render(row: UserDto) {
            return h(NSwitch, { value: row.status === 'active', onUpdateValue: () => handleStatusChange(row) })
        }
    },
    {
        title: 'Actions', key: 'actions', width: 120, fixed: 'right' as const, render(row: UserDto) {
            return h('div', { class: 'flex gap-2' }, [
                h(NButton, { text: true, type: 'primary', size: 'small', onClick: () => openEditDialog(row) }, { default: () => 'Edit' }),
                h(NButton, { text: true, type: 'error', size: 'small', onClick: () => handleDeleteUser(row) }, { default: () => 'Delete' })
            ])
        }
    }
]

const handleStatusChange = async (row: UserDto) => {
    if (!row.id) return
    try {
        await updateUserStatus(row.id, row.status === 'active' ? 'disabled' : 'active')
        message.success('Status updated')
        fetchUsers()
    } catch (e) {
        console.error(e)
    }
}

const openAddDialog = () => {
    userForm.value = { username: '', password: '', isSuperAdmin: false }
    dialogType.value = 'add'
    dialogVisible.value = true
}

const openEditDialog = (row: UserDto) => {
    userForm.value = { username: row.username, isSuperAdmin: row.isSuperAdmin }
    currentUserId.value = row.id!
    dialogType.value = 'edit'
    dialogVisible.value = true
}

const handleSubmitUser = async () => {
    if (!userForm.value.username) return
    if (dialogType.value === 'add' && !userForm.value.password) return
    submitting.value = true
    try {
        if (dialogType.value === 'add') {
            await createUser(userForm.value)
            message.success('User created')
        } else {
            await updateUser(currentUserId.value, userForm.value)
            message.success('User updated')
        }
        dialogVisible.value = false
        fetchUsers()
    } catch (e) {
        console.error(e)
    } finally {
        submitting.value = false
    }
}

const handleDeleteUser = (row: UserDto) => {
    dialog.warning({
        title: 'Confirm',
        content: `Are you sure you want to delete user ${row.username}?`,
        positiveText: 'Delete',
        negativeText: 'Cancel',
        onPositiveClick: async () => {
            if (!row.id) return
            try {
                await deleteUser(row.id)
                message.success('User deleted')
                fetchUsers()
            } catch (e) {
                console.error(e)
            }
        }
    })
}

onMounted(() => {
    fetchUsers()
})
</script>

<template>
    <div>
        <div class="flex items-center justify-between mb-8">
            <div>
                <h2 class="text-3xl font-bold text-white tracking-tight">User Management</h2>
                <p class="text-zinc-400 mt-1">Manage platform access and privileges.</p>
            </div>
            <n-button type="primary" @click="openAddDialog">Add User</n-button>
        </div>

        <div class="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
            <n-data-table :columns="columns" :data="users" :loading="loading" :bordered="false" class="dark-table"
                remote :pagination="pagination" />
        </div>

        <n-modal v-model:show="dialogVisible" preset="card" :title="dialogType === 'add' ? 'Add User' : 'Edit User'"
            class="max-w-[500px]" :bordered="false">
            <n-form>
                <n-form-item label="Username" required>
                    <n-input v-model:value="userForm.username" />
                </n-form-item>
                <n-form-item label="Password" :required="dialogType === 'add'">
                    <n-input v-model:value="userForm.password" type="password" show-password-on="click" />
                </n-form-item>
                <n-form-item label="Super Admin">
                    <n-switch v-model:value="userForm.isSuperAdmin" />
                </n-form-item>
            </n-form>
            <div class="flex justify-end gap-4 mt-6">
                <n-button @click="dialogVisible = false">Cancel</n-button>
                <n-button type="primary" :loading="submitting" @click="handleSubmitUser">Submit</n-button>
            </div>
        </n-modal>
    </div>
</template>

<style scoped>
:deep(.n-data-table) {
    background-color: transparent !important;
}
</style>
