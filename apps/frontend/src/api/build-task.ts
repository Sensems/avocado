import request from '@/utils/request'

export interface BuildTaskDto {
  id: string
  projectId: string
  version: string
  branch?: string
  commitHash?: string
  commitMessage?: string
  committer?: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'canceled'
  duration?: number
  env?: string
  createdAt: string
  /** 微信小程序体验版二维码路径，构建成功后由后端写入 */
  qrcodePath?: string
  /** 构建产物 ZIP 下载路径 */
  artifactPath?: string
  /** 构建日志文件路径 */
  logPath?: string
}

export function getBuildTasks(projectId: string, params?: { page?: number, limit?: number }) {
  return request({
    url: `/build-tasks/project/${projectId}`,
    method: 'get',
    params
  }) as Promise<any>
}

export function triggerBuild(projectId: string, data: { branch?: string, version?: string, env?: string, commitMessage?: string }) {
  return request({
    url: `/build-tasks/trigger`,
    method: 'post',
    data: { projectId, ...data }
  }) as Promise<any>
}

export function cancelTask(taskId: string) {
  return request({
    url: `/build-tasks/${taskId}/cancel`,
    method: 'post'
  }) as Promise<any>
}

export function deleteTask(taskId: string) {
  return request({
    url: `/build-tasks/${taskId}`,
    method: 'delete'
  }) as Promise<any>
}

export function reuploadFromHistory(taskId: string) {
  return request({
    url: `/build-tasks/${taskId}/reupload`,
    method: 'post'
  }) as Promise<any>
}

export function getTaskById(taskId: string) {
  return request({
    url: `/build-tasks/${taskId}`,
    method: 'get'
  }) as Promise<any>
}

