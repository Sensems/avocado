import request from '@/utils/request'

export interface CredentialDto {
  id?: string
  name: string
  type: 'ssh' | 'https'
  username?: string
  secret?: string
}

export function getCredentials() {
  return request({
    url: '/git-credentials',
    method: 'get',
  }) as Promise<any>
}

export function createCredential(data: CredentialDto) {
  return request({
    url: '/git-credentials',
    method: 'post',
    data,
  }) as Promise<any>
}

export function deleteCredential(id: string) {
  return request({
    url: `/git-credentials/${id}`,
    method: 'delete',
  }) as Promise<any>
}

export function testCredential(id: string) {
  return request({
    url: `/git-credentials/${id}/test`,
    method: 'post',
  }) as Promise<any>
}

/**
 * 通过仓库地址 + 凭证从后端动态获取远程分支列表
 */
export function fetchRepoBranches(repoUrl: string, credentialId?: string) {
  return request({
    url: '/git-credentials/list-branches',
    method: 'post',
    data: { repoUrl, credentialId },
  }) as Promise<any>
}
