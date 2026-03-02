import request from '@/utils/request'

export interface ProjectMemberDto {
  id: string
  userId: string
  username: string
  role: 'maintainer' | 'developer' | 'guest'
  createdAt: string
}

export function getProjectMembers(projectId: string) {
  return request({
    url: `/projects/${projectId}/members`,
    method: 'get'
  }) as Promise<any>
}

export function addProjectMember(projectId: string, data: { userId: string, role: string }) {
  return request({
    url: `/projects/${projectId}/members`,
    method: 'post',
    data
  }) as Promise<any>
}

export function updateProjectMemberRole(projectId: string, userId: string, role: string) {
  return request({
    url: `/projects/${projectId}/members/${userId}`,
    method: 'put',
    data: { role }
  }) as Promise<any>
}

export function removeProjectMember(projectId: string, userId: string) {
  return request({
    url: `/projects/${projectId}/members/${userId}`,
    method: 'delete'
  }) as Promise<any>
}
