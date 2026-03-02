<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getProjects, createProject } from '@/api/project'
import type { ProjectDto } from '@/api/project'
import { getCredentials } from '@/api/credential'
import { fetchRepoBranches } from '@/api/credential'
import { useRouter } from 'vue-router'
import { useMessage } from 'naive-ui'

const router = useRouter()
const message = useMessage()

const frameworkOptions = [
  { label: 'Native Miniprogram', value: 'native' },
  { label: 'Uni-App', value: 'uniapp' }
]

const projects = ref<ProjectDto[]>([])
const loading = ref(false)
const credentials = ref<any[]>([])

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

// ---- 新建项目弹窗 ----
const dialogVisible = ref(false)
const submitting = ref(false)
const fetchingBranches = ref(false)
const branchOptions = ref<{ label: string; value: string }[]>([])

const projectForm = ref<ProjectDto & { gitCredentialId?: string }>({
  name: '',
  repoUrl: '',
  framework: 'native',
  distPath: '',
  buildCommand: '',
  gitCredentialId: undefined,
})

/** 根据当前填写的 repoUrl + credentialId 获取分支列表 */
const handleFetchBranches = async () => {
  if (!projectForm.value.repoUrl) {
    message.warning('请先填写仓库地址')
    return
  }
  fetchingBranches.value = true
  branchOptions.value = []
  try {
    const res = await fetchRepoBranches(
      projectForm.value.repoUrl,
      projectForm.value.gitCredentialId ?? undefined,
    )
    const branches: string[] = res.data ?? []
    if (branches.length === 0) {
      message.warning('未获取到任何分支，请检查仓库地址和凭证')
    } else {
      branchOptions.value = branches.map(b => ({ label: b, value: b }))
      message.success(`已获取 ${branches.length} 个分支`)
    }
  } catch (e) {
    console.error(e)
    message.error('获取分支失败，请检查仓库地址和凭证')
  } finally {
    fetchingBranches.value = false
  }
}

const handleCreateProject = async () => {
  if (!projectForm.value.name || !projectForm.value.repoUrl) {
    message.warning('项目名称和仓库地址为必填项')
    return
  }

  submitting.value = true
  try {
    await createProject(projectForm.value)
    dialogVisible.value = false
    projectForm.value = {
      name: '',
      repoUrl: '',
      framework: 'native',
      distPath: '',
      buildCommand: '',
      gitCredentialId: undefined,
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
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-8">
      <div>
        <h2 class="text-3xl font-bold text-white tracking-tight">Projects</h2>
        <p class="text-zinc-400 mt-1">Manage all your CI/CD applications and workspaces.</p>
      </div>
      <n-button type="primary" size="large" @click="dialogVisible = true">New Project</n-button>
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
            Manage <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
            </svg>
          </span>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!loading && projects.length === 0"
        class="col-span-full py-20 text-center border border-dashed border-white/10 rounded-2xl bg-zinc-900/50">
        <h3 class="text-lg font-medium text-zinc-300 mb-2">No projects found</h3>
        <p class="text-zinc-500 mb-6">Get started by creating your first CI/CD project pipeline.</p>
        <n-button dashed size="large" @click="dialogVisible = true">Create Project</n-button>
      </div>
    </div>

    <!-- Create Project Modal -->
    <n-modal v-model:show="dialogVisible" preset="card" title="New Project" class="max-w-[540px]" :bordered="false">
      <n-form>
        <n-form-item label="Project Name" required>
          <n-input v-model:value="projectForm.name" placeholder="e.g. Avocado MiniProgram" />
        </n-form-item>
        <n-form-item label="Framework">
          <n-select v-model:value="projectForm.framework" :options="frameworkOptions" />
        </n-form-item>

        <n-divider class="my-2" />

        <!-- 仓库 + 凭证 -->
        <n-form-item label="Git Credential" required>
          <n-select v-model:value="projectForm.gitCredentialId" placeholder="选择 Git 凭证"
            :options="credentials.map(c => ({ label: c.name, value: c.id }))" clearable />
        </n-form-item>
        <n-form-item label="Repository URL" required>
          <div class="flex gap-2 w-full">
            <n-input v-model:value="projectForm.repoUrl" placeholder="https://github.com/org/repo.git" class="flex-1" />
            <n-button :loading="fetchingBranches" :disabled="!projectForm.repoUrl" @click="handleFetchBranches">
              获取分支
            </n-button>
          </div>
        </n-form-item>

        <!-- 分支展示（只读提示，创建时不选默认分支，项目设置里配） -->
        <n-form-item v-if="branchOptions.length > 0" label="可用分支">
          <div class="flex flex-wrap gap-1.5">
            <span v-for="branch in branchOptions" :key="branch.value"
              class="px-2 py-0.5 rounded text-xs bg-zinc-800 text-zinc-300 border border-white/10">
              {{ branch.label }}
            </span>
          </div>
        </n-form-item>

        <n-divider class="my-2" />

        <n-form-item label="Build Command">
          <n-input v-model:value="projectForm.buildCommand" placeholder="npm run build:mp-weixin" />
        </n-form-item>
        <n-form-item label="Distribution Path">
          <n-input v-model:value="projectForm.distPath" placeholder="dist/build/mp-weixin/" />
        </n-form-item>
      </n-form>
      <div class="flex justify-end gap-4 mt-6">
        <n-button @click="dialogVisible = false">Cancel</n-button>
        <n-button type="primary" :loading="submitting" @click="handleCreateProject">
          Create Project
        </n-button>
      </div>
    </n-modal>
  </div>
</template>

<style scoped></style>
