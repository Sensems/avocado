import request from '@/utils/request'

export type FrameworkType = 'native' | 'uniapp'

export interface ProjectDto {
  id?: string
  name: string
  /** 微信小程序 App ID */
  appId?: string
  repoUrl?: string
  repositoryUrl?: string
  /** 框架类型 */
  framework?: FrameworkType
  /** 构建命令 */
  buildCommand?: string
  /** 构建产物目录 */
  distPath?: string
  /** Git 凭证 ID */
  gitCredentialId?: string
  /** IM 通知机器人 ID 数组 */
  imRobotIds?: string[]
  /** 构建历史保留条数，默认 10 */
  retentionCount?: number
  /** 默认构建分支 */
  defaultBranch?: string
  members?: any[]
}

export function getProjects() {
  return request({
    url: '/projects',
    method: 'get',
  }) as Promise<any>
}

export function getProjectDetail(id: string) {
  return request({
    url: `/projects/${id}`,
    method: 'get',
  }) as Promise<any>
}

export function createProject(data: ProjectDto) {
  return request({
    url: '/projects',
    method: 'post',
    data,
  }) as Promise<any>
}

export function updateProject(id: string, data: Partial<ProjectDto>) {
  return request({
    url: `/projects/${id}`,
    method: 'put',
    data,
  }) as Promise<any>
}
