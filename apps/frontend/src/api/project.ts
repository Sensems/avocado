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
  /** Webhook 密钥 */
  webhookSecret?: string
  /** 小程序上传私钥文件 */
  privateKeyFile?: File | null
  /** 已保存的私钥路径 */
  privateKeyPath?: string
  /** 后端返回的 Webhook 完整地址 */
  webhookUrl?: string
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
  if (data.privateKeyFile) {
    const formData = new FormData()
    Object.keys(data).forEach(key => {
      const val = (data as any)[key]
      if (val !== undefined && val !== null) {
        if (Array.isArray(val)) {
          val.forEach((item: any) => formData.append(key, String(item)))
        } else {
          formData.append(key, val as any)
        }
      }
    })
    return request({
      url: '/projects',
      method: 'post',
      headers: { 'Content-Type': 'multipart/form-data' },
      data: formData,
    }) as Promise<any>
  }

  return request({
    url: '/projects',
    method: 'post',
    data,
  }) as Promise<any>
}

export function updateProject(id: string, data: Partial<ProjectDto>) {
  if (data.privateKeyFile) {
    const formData = new FormData()
    Object.keys(data).forEach(key => {
      const val = (data as any)[key]
      if (val !== undefined && val !== null) {
        if (Array.isArray(val)) {
          val.forEach((item: any) => formData.append(key, String(item)))
        } else {
          formData.append(key, val as any)
        }
      }
    })
    return request({
      url: `/projects/${id}`,
      method: 'put',
      headers: { 'Content-Type': 'multipart/form-data' },
      data: formData,
    }) as Promise<any>
  }

  return request({
    url: `/projects/${id}`,
    method: 'put',
    data,
  }) as Promise<any>
}
