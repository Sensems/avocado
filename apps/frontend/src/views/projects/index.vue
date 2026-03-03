<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getProjects, createProject } from '@/api/project'
import type { ProjectDto } from '@/api/project'
import { getCredentials } from '@/api/credential'
import { fetchRepoBranches } from '@/api/credential'
import { getRobots } from '@/api/robot'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'
import { useI18n } from 'vue-i18n'

const router = useRouter()
const message = useMessage()
const { t } = useI18n()

const frameworkOptions = [
  { label: t('projects.framework.native'), value: 'native' },
  { label: t('projects.framework.uniapp'), value: 'uniapp' }
]

const projects = ref<ProjectDto[]>([])
const loading = ref(false)
const credentials = ref<any[]>([])
const robots = ref<any[]>([])

const fetchProjects = async () => {
  loading.value = true
  try {
    const res = await getProjects()
    projects.value = res.data.items || []
  } catch (error) {
    console.error(error)
  } finally {
    loading.value = false
  }
}

const loadCredentials = async () => {
  try {
    const res = await getCredentials()
    credentials.value = res.data?.items || []
  } catch (e) {
    console.error(e)
  }
}

const loadRobots = async () => {
  try {
    const res = await getRobots()
    robots.value = res.data?.items || []
  } catch (e) {
    console.error(e)
  }
}

// ---- 新建项目弹窗 ----
const dialogVisible = ref(false)
const submitting = ref(false)
const fetchingBranches = ref(false)
const branchOptions = ref<{ label: string; value: string }[]>([])

const DEFAULT_BUILD_COMMAND = 'npm run build:mp-weixin'
const DEFAULT_DIST_PATH = 'dist/build/mp-weixin'

const projectForm = ref<ProjectDto & { gitCredentialId?: string }>({
  name: '',
  appId: '',
  repositoryUrl: '',
  framework: 'native',
  distPath: '',
  buildCommand: '',
  gitCredentialId: undefined,
  imRobotIds: [],
})

/** 根据当前填写的 repositoryUrl + credentialId 获取分支列表 */
const handleFetchBranches = async () => {
  if (!projectForm.value.repositoryUrl) {
    message.warning(t('projects.message.repoRequired'))
    return
  }
  fetchingBranches.value = true
  branchOptions.value = []
  try {
    const res = await fetchRepoBranches(
      projectForm.value.repositoryUrl,
      projectForm.value.gitCredentialId ?? undefined,
    )
    const branches: string[] = res.data ?? []
    if (branches.length === 0) {
      message.warning(t('projects.message.branchEmpty'))
    } else {
      branchOptions.value = branches.map(b => ({ label: b, value: b }))
      message.success(t('projects.message.branchSuccess', { count: branches.length }))
    }
  } catch (e) {
    console.error(e)
    message.error(t('projects.message.branchError'))
  } finally {
    fetchingBranches.value = false
  }
}

const handleCreateProject = async () => {
  if (!projectForm.value.name || !projectForm.value.repositoryUrl || !projectForm.value.appId) {
    message.warning(t('projects.validationError'))
    return
  }

  submitting.value = true
  try {
    await createProject({
      ...projectForm.value,
      buildCommand: projectForm.value.buildCommand || DEFAULT_BUILD_COMMAND,
      distPath: projectForm.value.distPath || DEFAULT_DIST_PATH,
    })
    dialogVisible.value = false
    projectForm.value = {
      name: '',
      appId: '',
      repositoryUrl: '',
      framework: 'native',
      distPath: '',
      buildCommand: '',
      gitCredentialId: undefined,
      imRobotIds: [],
    }
    branchOptions.value = []
    fetchProjects()
  } catch (error) {
    console.error(error)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  fetchProjects()
  loadCredentials()
  loadRobots()
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-8">
      <div>
        <h2 class="text-3xl font-bold text-white tracking-tight">{{ t('projects.title') }}</h2>
        <p class="text-zinc-400 mt-1">{{ t('projects.subtitle') }}</p>
      </div>
      <n-button type="primary" size="large" @click="dialogVisible = true">{{ t('projects.newProject') }}</n-button>
    </div>

    <div v-loading="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div v-for="project in projects" :key="project.id" @click="router.push(`/projects/${project.id}`)"
        class="bg-zinc-900 border border-white/5 hover:border-violet-500/50 hover:shadow-[0_0_30px_rgba(139,92,246,0.15)] rounded-2xl p-6 cursor-pointer transition-all duration-300 group">
        <div class="flex justify-between items-start mb-4">
          <div
            class="h-12 w-12 rounded-xl bg-zinc-800 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
            <span class="text-xl font-bold text-zinc-300">{{ project.name.charAt(0).toUpperCase() }}</span>
          </div>
          <span class="px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 border border-white/5">
            {{ project.framework || 'native' }}
          </span>
        </div>

        <h3 class="text-lg font-semibold text-zinc-100 group-hover:text-white transition-colors mb-1">{{ project.name }}
        </h3>
        <p class="text-sm text-zinc-500 truncate" :title="project.repoUrl">{{ project.repoUrl }}</p>

        <div class="mt-6 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
          <span>AppID: {{ project.appId || 'N/A' }}</span>
          <span class="text-sm font-medium text-violet-400 group-hover:text-violet-300 flex items-center gap-1">
            {{ t('projects.manage') }} <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </span>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!loading && projects.length === 0"
        class="col-span-full py-20 text-center border border-dashed border-white/10 rounded-2xl bg-zinc-900/50">
        <h3 class="text-lg font-medium text-zinc-300 mb-2">{{ t('projects.emptyTitle') }}</h3>
        <p class="text-zinc-500 mb-6">{{ t('projects.emptyDesc') }}</p>
        <n-button dashed size="large" @click="dialogVisible = true">{{ t('projects.createProject') }}</n-button>
      </div>
    </div>

    <!-- Create Project Modal -->
    <n-modal v-model:show="dialogVisible" preset="card" :title="t('projects.modal.title')" class="max-w-[720px]"
      :bordered="false">
      <div class="space-y-5">

        <!-- Section: 基本信息 -->
        <div>
          <p class="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">{{
            t('projects.modal.sectionBasic') }}</p>
          <div class="grid grid-cols-2 gap-x-4 gap-y-3">
            <!-- Project Name 占满整行 -->
            <div class="col-span-2">
              <label class="block text-xs text-zinc-400 mb-1">{{ t('projects.form.projectName') }} <span
                  class="text-red-400">*</span></label>
              <n-input v-model:value="projectForm.name" :placeholder="t('projects.form.projectNamePlaceholder')" />
            </div>
            <!-- Framework + AppID 并排 -->
            <div>
              <label class="block text-xs text-zinc-400 mb-1">{{ t('projects.form.framework') }}</label>
              <n-select v-model:value="projectForm.framework" :options="frameworkOptions" />
            </div>
            <div>
              <label class="block text-xs text-zinc-400 mb-1">{{ t('projects.form.appId') }} <span
                  class="text-red-400">*</span></label>
              <n-input v-model:value="projectForm.appId" placeholder="wx1234567890abcdef" />
            </div>
          </div>
        </div>

        <n-divider class="!my-0" />

        <!-- Section: 仓库配置 -->
        <div>
          <p class="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">{{
            t('projects.modal.sectionRepo') }}</p>
          <div class="grid grid-cols-2 gap-x-4 gap-y-3">
            <!-- Git Credential -->
            <div>
              <label class="block text-xs text-zinc-400 mb-1">{{ t('projects.form.gitCredential') }}</label>
              <div class="flex gap-2">
                <n-select v-model:value="projectForm.gitCredentialId"
                  :placeholder="t('projects.form.gitCredentialPlaceholder')"
                  :options="credentials.map(c => ({ label: c.name, value: c.id }))" clearable class="flex-1" />
                <n-button tag="a" href="/admin/credentials" target="_blank" :title="t('projects.form.goToCredentials')">
                  <template #icon>
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                  </template>
                </n-button>
              </div>
            </div>
            <!-- Repository URL -->
            <div>
              <label class="block text-xs text-zinc-400 mb-1">{{ t('projects.form.repoUrl') }} <span
                  class="text-red-400">*</span></label>
              <div class="flex gap-2">
                <n-input v-model:value="projectForm.repositoryUrl" placeholder="https://github.com/org/repo.git"
                  class="flex-1" />
                <n-button :loading="fetchingBranches" :disabled="!projectForm.repositoryUrl"
                  @click="handleFetchBranches">
                  {{ t('projects.form.fetchBranches') }}
                </n-button>
              </div>
            </div>
          </div>
          <!-- 可用分支标签 -->
          <div v-if="branchOptions.length > 0" class="mt-3">
            <p class="text-xs text-zinc-500 mb-1.5">{{ t('projects.form.availableBranches') }}</p>
            <div class="flex flex-wrap gap-1.5">
              <span v-for="branch in branchOptions" :key="branch.value"
                class="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-300 border border-white/10">
                {{ branch.label }}
              </span>
            </div>
          </div>
        </div>

        <n-divider class="!my-0" />

        <!-- Section: 构建配置 -->
        <div>
          <p class="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">{{
            t('projects.modal.sectionBuild')
            }}</p>
          <div class="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <label class="block text-xs text-zinc-400 mb-1">{{ t('projects.form.buildCommand') }}</label>
              <n-input v-model:value="projectForm.buildCommand" :placeholder="DEFAULT_BUILD_COMMAND" />
              <p class="text-[11px] text-zinc-600 mt-1">{{ t('projects.form.buildCommandHint') }}</p>
            </div>
            <div>
              <label class="block text-xs text-zinc-400 mb-1">{{ t('projects.form.distPath') }}</label>
              <n-input v-model:value="projectForm.distPath" :placeholder="DEFAULT_DIST_PATH" />
              <p class="text-[11px] text-zinc-600 mt-1">{{ t('projects.form.distPathHint') }}</p>
            </div>
          </div>
        </div>

        <n-divider class="!my-0" />

        <!-- Section: 集成通知 -->
        <div>
          <p class="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">{{
            t('projects.modal.sectionNotifications') }}</p>
          <div>
            <label class="block text-xs text-zinc-400 mb-1">{{ t('projects.form.imRobot') }}</label>
            <div class="flex gap-2">
              <n-select v-model:value="projectForm.imRobotIds" multiple
                :placeholder="t('projects.form.imRobotPlaceholder')"
                :options="robots.map(r => ({ label: r.name, value: r.id }))" clearable class="flex-1" />
              <n-button tag="a" href="/admin/robots" target="_blank" :title="t('projects.form.goToRobots')">
                <template #icon>
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                </template>
              </n-button>
            </div>
          </div>
        </div>

      </div>

      <div class="flex justify-end gap-4 mt-6">
        <n-button @click="dialogVisible = false">{{ t('common.cancel') }}</n-button>
        <n-button type="primary" :loading="submitting" @click="handleCreateProject">{{ t('projects.createProject')
          }}</n-button>
      </div>
    </n-modal>
  </div>
</template>

<style scoped></style>
