<script setup lang="ts">
import { ref, onMounted, watch, h, computed } from 'vue'
import { useRoute } from 'vue-router'
import { getProjectDetail, updateProject } from '@/api/project'
import type { ProjectDto } from '@/api/project'
import { getBuildTasks, cancelTask, triggerBuild } from '@/api/build-task'
import type { BuildTaskDto } from '@/api/build-task'
import { getCredentials, fetchRepoBranches } from '@/api/credential'
import { getRobots } from '@/api/robot'
import { addProjectMember, updateProjectMemberRole, removeProjectMember } from '@/api/project-member'
import type { ProjectMemberDto } from '@/api/project-member'
import { getUsers } from '@/api/user'
import WebSocketTerminal from '@/components/WebSocketTerminal.vue'
import { useMessage, useDialog, NTag, NButton, NSelect, NDrawer, NDrawerContent } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const message = useMessage()
const dialog = useDialog()
const { t } = useI18n()

const route = useRoute()
const projectId = route.params.id as string
const project = ref<ProjectDto | null>(null)
const activeTab = ref('history')
const loading = ref(false)
const saving = ref(false)

// Select Options
const credentials = ref<any[]>([])
const robots = ref<any[]>([])
const sysUsers = ref<any[]>([])

// Builds State
const buildTasks = ref<any[]>([])
const loadingBuilds = ref(false)
const activeBuildTaskId = ref('')
const triggering = ref(false)
const buildBranch = ref('')
const buildVersion = ref('')

// 分支相关
const buildBranchOptions = ref<{ label: string; value: string }[]>([])
const loadingBuildBranches = ref(false)
const settingsBranchOptions = ref<{ label: string; value: string }[]>([])
const loadingSettingsBranches = ref(false)

/**
 * 将 semver patch 位 +1（1.0.0 -> 1.0.1）。
 * 若版本号不符合 x.y.z 格式则原样返回。
 */
const bumpPatchVersion = (version: string | undefined): string => {
    if (!version) return '1.0.0'
    const parts = version.split('.')
    if (parts.length === 3) {
        const patch = parseInt(parts[2]!, 10)
        if (!isNaN(patch)) {
            return `${parts[0]}.${parts[1]}.${patch + 1}`
        }
    }
    return version
}

// Log Drawer State
const logDrawerOpen = ref(false)
const logTaskId = ref('')
const logTaskVersion = ref('')
const logTaskLogPath = ref('')
const logTaskStatus = ref('')

// Download Drawer State
const downloadDrawerOpen = ref(false)
const downloadTask = ref<BuildTaskDto | null>(null)

// Members State
const members = ref<any[]>([])
const memberDialog = ref(false)
const memberForm = ref({ userId: '', role: 'developer' })

// Webhook & Keys Logic
const newPrivateKeyFile = ref<File | null>(null)

const copyWebhookUrl = () => {
    const url = project.value?.webhookUrl ?? ''
    navigator.clipboard.writeText(url).then(() => {
        message.success(t('projectDetail.settings.copySuccess'))
    }).catch(() => {
        message.error('复制失败，请手动选择复制')
    })
}

const generateSecret = () => {
    if (!project.value) return
    // Simple random hex generation
    const array = new Uint8Array(16)
    window.crypto.getRandomValues(array)
    const hex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
    project.value.webhookSecret = hex
}

/** 通用：获取仓库分支列表 */
const loadBranches = async (repoUrl: string, credentialId?: string): Promise<string[]> => {
    try {
        const res = await fetchRepoBranches(repoUrl, credentialId ?? undefined)
        return res.data ?? []
    } catch {
        return []
    }
}

/** 给触发构建区域加载分支 */
const loadBuildBranches = async () => {
    if (!project.value?.repoUrl) return
    loadingBuildBranches.value = true
    const branches = await loadBranches(project.value.repoUrl, project.value.gitCredentialId ?? undefined)
    buildBranchOptions.value = branches.map(b => ({ label: b, value: b }))
    loadingBuildBranches.value = false

    // 若未选分支则使用项目默认分支兜底
    if (!buildBranch.value) {
        buildBranch.value = project.value?.defaultBranch || branches[0] || 'main'
    }
}

/** 给 Settings 区域加载分支 */
const loadSettingsBranches = async () => {
    if (!project.value?.repoUrl) return
    loadingSettingsBranches.value = true
    const branches = await loadBranches(project.value.repoUrl, project.value.gitCredentialId ?? undefined)
    settingsBranchOptions.value = branches.map(b => ({ label: b, value: b }))
    loadingSettingsBranches.value = false
}

const fetchProject = async () => {
    loading.value = true
    try {
        const res = await getProjectDetail(projectId)
        project.value = res.data
        members.value = res.data?.members?.map((m: any) => ({
            ...m,
            username: m.user?.username
        })) || []
    } catch (err) {
        console.error(err)
    } finally {
        loading.value = false
    }
}

const loadDependencies = async () => {
    try {
        const [credRes, robotRes, userRes] = await Promise.all([
            getCredentials(),
            getRobots(),
            getUsers()
        ])
        credentials.value = credRes.data?.items || []
        robots.value = robotRes.data?.items || []
        sysUsers.value = userRes.data?.items || []
    } catch (e) {
        console.error(e)
    }
}

// Builds Logic
const fetchBuilds = async () => {
    loadingBuilds.value = true
    try {
        const res = await getBuildTasks(projectId)
        buildTasks.value = res.data?.items || []
        // 自动将默认版本号设为上次构建版本 +1
        const lastVersion: string | undefined = buildTasks.value[0]?.version
        buildVersion.value = bumpPatchVersion(lastVersion)
    } catch (e) {
        console.error(e)
    } finally {
        loadingBuilds.value = false
    }
}

const handleViewLog = (row: BuildTaskDto) => {
    logTaskId.value = row.id
    logTaskVersion.value = row.version || row.id.substring(0, 8)
    logTaskLogPath.value = row.logPath ?? ''
    logTaskStatus.value = row.status
    logDrawerOpen.value = true
}

/** 将后端存储路径转换为可访问的完整 URL */
const resolveStorageUrl = (storagePath: string): string => {
    const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/api$/, '')
    return `${base}${storagePath}`
}

const handleDownload = (row: BuildTaskDto) => {
    downloadTask.value = row
    downloadDrawerOpen.value = true
}

const downloadFile = (storagePath: string, filename: string) => {
    console.log("🚀 ~ downloadFile ~ storagePath:", storagePath)
    const url = resolveStorageUrl(storagePath)
    console.log("🚀 ~ downloadFile ~ url:", url)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.target = '_blank'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
}

const handleTriggerBuild = async () => {
    triggering.value = true
    try {
        const res = await triggerBuild(projectId, {
            branch: buildBranch.value || project.value?.defaultBranch || 'main',
            version: buildVersion.value || undefined,
        })
        message.success(t('projectDetail.terminal.buildSuccess'))
        activeBuildTaskId.value = res.data?.id
        activeTab.value = 'terminal'
        fetchBuilds()
    } catch (e) {
        console.error(e)
    } finally {
        triggering.value = false
    }
}

const handleCancelTask = async (taskId: string) => {
    dialog.warning({
        title: t('projectDetail.cancel.dialogTitle'),
        content: t('projectDetail.cancel.dialogContent'),
        positiveText: t('projectDetail.cancel.positiveText'),
        negativeText: t('projectDetail.cancel.negativeText'),
        onPositiveClick: async () => {
            try {
                await cancelTask(taskId)
                message.success(t('projectDetail.cancel.canceledMsg'))
                fetchBuilds()
            } catch (e) {
                console.error(e)
            }
        }
    })
}

const formatDate = (dateStr: string) => {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return isNaN(d.getTime()) ? dateStr : new Intl.DateTimeFormat('zh-CN', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(d)
}

// Settings Logic
const handleUpdateSettings = async () => {
    if (!project.value) return
    saving.value = true
    try {
        const payload: Partial<ProjectDto> = {
            name: project.value.name,
            appId: project.value.appId,
            repositoryUrl: project.value.repoUrl,
            framework: project.value.framework,
            buildCommand: project.value.buildCommand,
            distPath: project.value.distPath,
            gitCredentialId: project.value.gitCredentialId,
            imRobotIds: project.value.imRobotIds,
            retentionCount: project.value.retentionCount,
            defaultBranch: project.value.defaultBranch,
            webhookSecret: project.value.webhookSecret,
            privateKeyFile: newPrivateKeyFile.value,
        }
        await updateProject(projectId, payload)
        message.success(t('projectDetail.settings.saveSuccess'))
        newPrivateKeyFile.value = null
        fetchProject()
    } catch (e) {
        console.error(e)
    } finally {
        saving.value = false
    }
}

const handleAddMember = async () => {
    if (!memberForm.value.userId) return
    try {
        await addProjectMember(projectId, memberForm.value)
        message.success(t('projectDetail.members.added'))
        memberDialog.value = false
        fetchProject()
    } catch (e) {
        console.error(e)
    }
}

const handleRemoveMember = async (userId: string) => {
    dialog.warning({
        title: t('projectDetail.members.removeConfirmTitle'),
        content: t('projectDetail.members.removeConfirmContent'),
        positiveText: t('projectDetail.members.removeConfirmOk'),
        negativeText: t('projectDetail.members.removeConfirmCancel'),
        onPositiveClick: async () => {
            try {
                await removeProjectMember(projectId, userId)
                message.success(t('projectDetail.members.removed'))
                fetchProject()
            } catch (e) {
                console.error(e)
            }
        }
    })
}

const handleRoleChange = async (userId: string, role: string) => {
    try {
        await updateProjectMemberRole(projectId, userId, role)
        message.success(t('projectDetail.members.roleUpdated'))
        fetchProject()
    } catch (e) {
        console.error(e)
    }
}

// 当 Settings tab 激活时，加载分支选项
watch(activeTab, (tab) => {
    if (tab === 'settings' && project.value?.repoUrl && settingsBranchOptions.value.length === 0) {
        loadSettingsBranches()
    }
})

onMounted(async () => {
    await fetchProject()
    loadDependencies()
    fetchBuilds()
    // 项目加载完成后，拉取构建分支（用于触发构建下拉）
    if (project.value?.repoUrl) {
        loadBuildBranches()
    }
})

// 使用 computed 确保 t() 响应式
const buildColumns = computed(() => [
    {
        title: t('projectDetail.history.colVersion'), key: 'version', width: 120, render(row: BuildTaskDto) {
            return h('span', { class: 'font-mono text-xs bg-zinc-800 px-2 py-1 rounded text-zinc-300' }, row.version || row.id!.substring(0, 8))
        }
    },
    {
        title: t('projectDetail.history.colStatus'), key: 'status', width: 120, render(row: BuildTaskDto) {
            const type = row.status === 'success' ? 'success' : row.status === 'failed' ? 'error' : row.status === 'running' ? 'info' : 'warning';
            return h(NTag, { type, size: 'small', bordered: false }, { default: () => row.status?.toUpperCase() })
        }
    },
    {
        title: t('projectDetail.history.colCommit'), key: 'commitMessage', minWidth: 200, render(row: BuildTaskDto) {
            return h('div', { class: 'flex flex-col' }, [
                h('div', { class: 'truncate text-sm', title: row.commitMessage }, row.commitMessage || t('projectDetail.history.manualTrigger')),
                row.commitHash ? h('div', { class: 'text-xs text-zinc-500 font-mono mt-0.5' }, row.commitHash.substring(0, 7)) : null
            ])
        }
    },
    {
        title: t('projectDetail.history.colDuration'), key: 'duration', width: 100, render(row: BuildTaskDto) {
            return row.duration ? `${row.duration}s` : '-'
        }
    },
    {
        title: t('projectDetail.history.colDate'), key: 'createdAt', width: 160, render(row: BuildTaskDto) {
            return h('span', { class: 'text-zinc-400 text-sm' }, formatDate(row.createdAt as string))
        }
    },
    {
        title: t('projectDetail.history.colActions'), key: 'actions', width: 220, fixed: 'right' as const, align: 'right' as const, render(row: BuildTaskDto) {
            return h('div', { class: 'flex gap-2 justify-end' }, [
                h(NButton, { text: true, type: 'info', size: 'small', onClick: () => handleViewLog(row) }, { default: () => t('projectDetail.history.viewLogs') }),
                h(NButton, { text: true, type: 'primary', size: 'small', disabled: !row.artifactPath && !row.qrcodePath, onClick: () => handleDownload(row) }, { default: () => t('projectDetail.history.download') }),
                h(NButton, { text: true, type: 'warning', size: 'small', disabled: row.status === 'success' || row.status === 'failed' || row.status === 'canceled', onClick: () => handleCancelTask(row.id as string) }, { default: () => t('projectDetail.history.cancelBuild') })
            ])
        }
    }
])

const memberColumns = computed(() => [
    { title: t('projectDetail.members.colUser'), key: 'username' },
    {
        title: t('projectDetail.members.colRole'), key: 'role', width: 180, render(row: ProjectMemberDto) {
            return h(NSelect, {
                value: row.role, size: 'small', options: [
                    { label: t('projectDetail.members.roleOptions.maintainer'), value: 'maintainer' },
                    { label: t('projectDetail.members.roleOptions.developer'), value: 'developer' },
                    { label: t('projectDetail.members.roleOptions.guest'), value: 'guest' }
                ], onUpdateValue: (val) => handleRoleChange(row.userId, val as string)
            })
        }
    },
    {
        title: t('projectDetail.members.colActions'), key: 'actions', width: 100, fixed: 'right' as const, align: 'right' as const, render(row: ProjectMemberDto) {
            return h(NButton, { text: true, type: 'error', size: 'small', onClick: () => handleRemoveMember(row.userId) }, { default: () => t('projectDetail.members.remove') })
        }
    }
])
</script>

<template>
    <n-spin :show="loading">
        <div class="flex items-center justify-between mb-8">
            <div>
                <div class="flex items-center gap-3">
                    <h2 class="text-3xl font-bold text-white tracking-tight">{{ project?.name ||
                        t('projectDetail.loadingTitle') }}
                    </h2>
                    <span v-if="project?.framework"
                        class="px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-white/5">
                        {{ project.framework }}
                    </span>
                </div>
                <p class="text-zinc-400 mt-1 flex items-center gap-2">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1">
                        </path>
                    </svg> {{ project?.repoUrl }}
                </p>
            </div>
            <n-button dashed @click="$router.push('/projects')">{{ t('projectDetail.backToProjects') }}</n-button>
        </div>

        <!-- Main Tabs Area -->
        <div class="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
            <n-tabs v-model:value="activeTab" type="line" class="w-full project-tabs px-6" animated>
                <n-tab-pane :label="t('projectDetail.tabHistory')" name="history">
                    <div class="p-6">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-xl font-semibold text-white">{{ t('projectDetail.tabHistory') }}</h3>
                            <n-button dashed size="small" @click="fetchBuilds" :loading="loadingBuilds">{{
                                t('common.refresh') }}</n-button>
                        </div>
                        <n-data-table :columns="buildColumns" :data="buildTasks" :loading="loadingBuilds"
                            :bordered="false" class="dark-table" />
                    </div>
                </n-tab-pane>

                <n-tab-pane :label="t('projectDetail.tabTerminal')" name="terminal">
                    <div class="p-6">
                        <div class="flex justify-between items-center mb-4">
                            <h3 class="text-xl font-semibold text-white">{{ t('projectDetail.terminal.title') }}</h3>
                            <div class="flex items-center gap-2">
                                <!-- 版本号 -->
                                <n-input v-model:value="buildVersion" size="small"
                                    :placeholder="t('projectDetail.terminal.versionPlaceholder')" style="width: 148px">
                                    <template #prefix>
                                        <svg class="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor"
                                            viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                        </svg>
                                    </template>
                                </n-input>
                                <!-- 分支下拉选择 -->
                                <n-select v-model:value="buildBranch" filterable tag size="small"
                                    :placeholder="t('projectDetail.terminal.branchPlaceholder')" style="width: 180px"
                                    :loading="loadingBuildBranches" :options="buildBranchOptions"
                                    :fallback-option="(v: string) => ({ label: v, value: v })">
                                    <template #arrow>
                                        <svg class="w-3.5 h-3.5 text-zinc-400" fill="none" stroke="currentColor"
                                            viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                d="M6 3v12m0 0a3 3 0 103 3m-3-3a3 3 0 00-3 3m12-9a3 3 0 100-6 3 3 0 000 6zm0 0v6m0 6a3 3 0 100-6 3 3 0 000 6z" />
                                        </svg>
                                    </template>
                                </n-select>
                                <n-button size="small" dashed :loading="loadingBuildBranches" @click="loadBuildBranches"
                                    :title="t('projectDetail.terminal.refreshBranches')">
                                    <template #icon>
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                    </template>
                                </n-button>
                                <n-button type="info" dashed size="small" :loading="triggering"
                                    @click="handleTriggerBuild">{{
                                        t('projectDetail.terminal.triggerBuild') }}</n-button>
                            </div>
                        </div>
                        <div v-if="activeBuildTaskId">
                            <WebSocketTerminal :task-id="activeBuildTaskId" />
                        </div>
                        <div v-else
                            class="text-zinc-500 italic py-10 text-center border border-dashed border-white/10 rounded-xl">
                            {{ t('projectDetail.terminal.noActiveBuild') }}
                        </div>
                    </div>
                </n-tab-pane>

                <n-tab-pane :label="t('projectDetail.tabMembers')" name="members">
                    <div class="p-6">
                        <div class="flex items-center justify-between mb-4">
                            <h3 class="text-xl font-semibold text-white">{{ t('projectDetail.members.title') }}</h3>
                            <n-button type="primary" size="small" @click="memberDialog = true">{{
                                t('projectDetail.members.addMember')
                                }}</n-button>
                        </div>
                        <n-data-table :columns="memberColumns" :data="members" :bordered="false" class="dark-table" />
                    </div>
                </n-tab-pane>

                <n-tab-pane :label="t('projectDetail.tabSettings')" name="settings">
                    <div class="p-6 max-w-2xl">
                        <h3 class="text-xl font-semibold mb-6 text-white">{{ t('projectDetail.settings.title') }}</h3>
                        <n-form v-if="project" label-placement="left" label-width="160">

                            <!-- 基本信息 -->
                            <p class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{{
                                t('projectDetail.settings.sectionBasic') }}</p>
                            <n-form-item :label="t('projectDetail.settings.projectName')">
                                <n-input v-model:value="project.name" />
                            </n-form-item>
                            <n-form-item :label="t('projectDetail.settings.framework')">
                                <n-select v-model:value="project.framework" class="w-full" :options="[
                                    { label: '原生小程序', value: 'native' },
                                    { label: 'UniApp', value: 'uniapp' },
                                ]" />
                            </n-form-item>
                            <n-form-item :label="t('projectDetail.settings.appId')">
                                <n-input v-model:value="project.appId" placeholder="wx1234567890abcdef（微信小程序 AppID）" />
                            </n-form-item>

                            <n-divider class="my-4" />

                            <!-- 仓库与构建 -->
                            <p class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{{
                                t('projectDetail.settings.sectionRepoAndBuild') }}</p>
                            <n-form-item :label="t('projectDetail.settings.repoUrl')">
                                <n-input v-model:value="project.repoUrl" placeholder="git@github.com:org/repo.git" />
                            </n-form-item>
                            <n-form-item :label="t('projectDetail.settings.buildCommand')">
                                <n-input v-model:value="project.buildCommand"
                                    placeholder="e.g. npm run build:mp-weixin" />
                            </n-form-item>
                            <n-form-item :label="t('projectDetail.settings.distPath')">
                                <n-input v-model:value="project.distPath" placeholder="e.g. dist/build/mp-weixin" />
                            </n-form-item>
                            <n-form-item :label="t('projectDetail.settings.retentionCount')">
                                <n-input-number v-model:value="project.retentionCount" :min="1" :max="100"
                                    placeholder="10" class="w-full" />
                            </n-form-item>

                            <!-- 默认构建分支 -->
                            <n-form-item :label="t('projectDetail.settings.defaultBranch')">
                                <div class="flex gap-2 w-full">
                                    <n-select v-model:value="project.defaultBranch" filterable tag clearable
                                        :placeholder="t('projectDetail.settings.defaultBranchPlaceholder')"
                                        class="flex-1" :loading="loadingSettingsBranches"
                                        :options="settingsBranchOptions"
                                        :fallback-option="(v: string) => ({ label: v, value: v })" />
                                    <n-button :loading="loadingSettingsBranches" @click="loadSettingsBranches"
                                        :title="t('projectDetail.settings.refreshBranches')">
                                        <template #icon>
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                            </svg>
                                        </template>
                                    </n-button>
                                </div>
                                <template #feedback>
                                    <span class="text-xs text-zinc-500">{{ t('projectDetail.settings.defaultBranchHint')
                                        }}</span>
                                </template>
                            </n-form-item>

                            <n-divider class="my-4" />

                            <!-- 集成 -->
                            <p class="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">{{
                                t('projectDetail.settings.sectionIntegrations') }}</p>

                            <n-form-item :label="t('projectDetail.settings.webhookUrl')">
                                <div class="flex gap-2 w-full items-center">
                                    <!-- <span
                                        class="px-3 py-1.5 rounded text-sm font-mono select-all flex-1 border overflow-hidden text-ellipsis whitespace-nowrap">{{
                                            webhookUrl }}</span> -->
                                    <n-input readonly :value="project?.webhookUrl ?? ''" class="flex-1" />
                                    <n-button dashed @click="copyWebhookUrl"
                                        :title="t('projectDetail.settings.copyWebhookUrl')">
                                        <template #icon>
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z">
                                                </path>
                                            </svg>
                                        </template>
                                    </n-button>
                                </div>
                            </n-form-item>

                            <n-form-item :label="t('projectDetail.settings.webhookSecret')">
                                <div class="flex gap-2 w-full">
                                    <n-input v-model:value="project.webhookSecret" type="password"
                                        show-password-on="click"
                                        :placeholder="t('projectDetail.settings.webhookSecretPlaceholder')"
                                        class="flex-1" />
                                    <n-button dashed @click="generateSecret"
                                        :title="t('projectDetail.settings.generateRandomWebhookSecret')">
                                        <template #icon>
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15">
                                                </path>
                                            </svg>
                                        </template>
                                    </n-button>
                                </div>
                            </n-form-item>

                            <n-form-item :label="t('projectDetail.settings.privateKeyFile')">
                                <n-upload accept=".key" :max="1" :show-file-list="true" :default-upload="false" @change="(data: any) => {
                                    if (data.fileList && data.fileList.length > 0) {
                                        newPrivateKeyFile = data.fileList[0].file;
                                    } else {
                                        newPrivateKeyFile = null;
                                    }
                                }" class="w-full">
                                    <n-button dashed class="w-full justify-start text-zinc-400">
                                        <template #icon>
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13">
                                                </path>
                                            </svg>
                                        </template>
                                        {{ t('projectDetail.settings.privateKeyFilePlaceholder') }}
                                    </n-button>
                                </n-upload>
                                <template #feedback v-if="project.privateKeyPath">
                                    <span class="text-xs text-emerald-500 flex items-center gap-1 mt-1">
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                d="M5 13l4 4L19 7"></path>
                                        </svg>
                                        已有上传的密钥文件
                                    </span>
                                </template>
                            </n-form-item>

                            <n-form-item :label="t('projectDetail.settings.gitCredential')">
                                <div class="flex gap-2 w-full">
                                    <n-select v-model:value="project.gitCredentialId"
                                        :placeholder="t('projectDetail.settings.gitCredentialPlaceholder')" clearable
                                        class="flex-1"
                                        :options="credentials.map(c => ({ label: c.name, value: c.id }))" />
                                    <n-button tag="a" href="/admin/credentials" target="_blank" title="前往凭证管理页面">
                                        <template #icon>
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M12 4v16m8-8H4" />
                                            </svg>
                                        </template>
                                    </n-button>
                                </div>
                            </n-form-item>
                            <n-form-item :label="t('projectDetail.settings.imRobots')">
                                <div class="flex gap-2 w-full">
                                    <n-select v-model:value="project.imRobotIds" multiple
                                        :placeholder="t('projectDetail.settings.imRobotsPlaceholder')" class="flex-1"
                                        :options="robots.map(r => ({ label: r.name, value: r.id }))" />
                                    <n-button tag="a" href="/admin/robots" target="_blank" title="前往机器人管理页面">
                                        <template #icon>
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                                    d="M12 4v16m8-8H4" />
                                            </svg>
                                        </template>
                                    </n-button>
                                </div>
                            </n-form-item>

                            <div class="mt-6">
                                <n-button type="primary" :loading="saving" @click="handleUpdateSettings">{{
                                    t('projectDetail.settings.saveConfig') }}</n-button>
                            </div>
                        </n-form>
                    </div>
                </n-tab-pane>
            </n-tabs>
        </div>

        <!-- Member Modal -->
        <n-modal v-model:show="memberDialog" preset="card" :title="t('projectDetail.members.dialog.title')"
            class="max-w-[400px]" :bordered="false">
            <n-form>
                <n-form-item :label="t('projectDetail.members.dialog.selectUser')">
                    <n-select v-model:value="memberForm.userId" filterable
                        :placeholder="t('projectDetail.members.dialog.selectUserPlaceholder')" class="w-full"
                        :options="sysUsers.map(u => ({ label: u.username, value: u.id }))" />
                </n-form-item>
                <n-form-item :label="t('projectDetail.members.dialog.role')">
                    <n-select v-model:value="memberForm.role" class="w-full" :options="[
                        { label: t('projectDetail.members.roleOptions.maintainer'), value: 'maintainer' },
                        { label: t('projectDetail.members.roleOptions.developer'), value: 'developer' },
                        { label: t('projectDetail.members.roleOptions.guest'), value: 'guest' }
                    ]" />
                </n-form-item>
            </n-form>
            <div class="flex justify-end gap-4 mt-6">
                <n-button @click="memberDialog = false">{{ t('common.cancel') }}</n-button>
                <n-button type="primary" @click="handleAddMember">{{ t('projectDetail.members.addMember') }}</n-button>
            </div>
        </n-modal>

        <!-- Build Log Drawer -->
        <n-drawer v-model:show="logDrawerOpen" :width="860" placement="right" @after-leave="logTaskId = ''">
            <n-drawer-content :title="t('projectDetail.logDrawerTitle', { version: logTaskVersion })" closable>
                <WebSocketTerminal v-if="logTaskId" :task-id="logTaskId" :log-path="logTaskLogPath || undefined"
                    :status="logTaskStatus" />
            </n-drawer-content>
        </n-drawer>

        <!-- Download Drawer -->
        <n-drawer v-model:show="downloadDrawerOpen" :width="480" placement="right" @after-leave="downloadTask = null">
            <n-drawer-content
                :title="t('projectDetail.downloadDrawerTitle', { version: downloadTask?.version || downloadTask?.id?.substring(0, 8) || '' })"
                closable>
                <div v-if="downloadTask" class="flex flex-col gap-6">
                    <!-- 体验版二维码 -->
                    <div v-if="downloadTask.qrcodePath"
                        class="flex flex-col items-center gap-3 p-6 rounded-xl bg-zinc-800/60 border border-white/5">
                        <p class="text-sm text-zinc-400 font-medium">{{ t('projectDetail.download.qrcode') }}</p>
                        <img :src="resolveStorageUrl(downloadTask.qrcodePath)" alt="QR Code"
                            class="w-48 h-48 rounded-lg object-contain bg-white p-2" />
                        <p class="text-xs text-zinc-500">{{ t('projectDetail.download.qrcodeScan') }}</p>
                        <n-button size="small" dashed
                            @click="downloadFile(downloadTask!.qrcodePath!, `qrcode-${downloadTask!.version}.jpg`)">
                            {{ t('projectDetail.download.downloadQrcode') }}
                        </n-button>
                    </div>

                    <!-- 产物 ZIP -->
                    <div v-if="downloadTask.artifactPath"
                        class="flex items-center justify-between p-4 rounded-xl bg-zinc-800/60 border border-white/5">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                                <svg class="w-5 h-5 text-violet-400" fill="none" stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                            </div>
                            <div>
                                <p class="text-sm font-medium text-white">{{ t('projectDetail.download.artifact') }}</p>
                                <p class="text-xs text-zinc-400">artifact-{{ downloadTask.id }}.zip</p>
                            </div>
                        </div>
                        <n-button type="primary" size="small"
                            @click="downloadFile(downloadTask!.artifactPath!, `artifact-${downloadTask!.version}.zip`)">
                            {{ t('projectDetail.download.downloadBtn') }}
                        </n-button>
                    </div>

                    <!-- 构建日志 -->
                    <div v-if="downloadTask.logPath?.startsWith('/storage')"
                        class="flex items-center justify-between p-4 rounded-xl bg-zinc-800/60 border border-white/5">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <div>
                                <p class="text-sm font-medium text-white">{{ t('projectDetail.download.log') }}</p>
                                <p class="text-xs text-zinc-400">build-{{ downloadTask.id }}.log</p>
                            </div>
                        </div>
                        <n-button size="small" dashed
                            @click="downloadFile(downloadTask!.logPath!, `build-log-${downloadTask!.version}.log`)">
                            {{ t('projectDetail.download.downloadBtn') }}
                        </n-button>
                    </div>

                    <!-- 无任何产物 -->
                    <div v-if="!downloadTask.qrcodePath && !downloadTask.artifactPath && !downloadTask.logPath?.startsWith('/storage')"
                        class="text-center py-10 text-zinc-500 italic">
                        {{ t('projectDetail.download.noArtifacts') }}
                    </div>
                </div>
            </n-drawer-content>
        </n-drawer>
    </n-spin>
</template>

<style scoped>
/* Enhance Element Plus Tabs to fit the dark theme */
:deep(.n-tabs-tab) {
    font-size: 15px !important;
    padding-top: 16px !important;
    padding-bottom: 16px !important;
}

:deep(.n-data-table) {
    background-color: transparent !important;
}
</style>
