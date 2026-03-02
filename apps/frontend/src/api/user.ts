import request from '@/utils/request'

export interface UserDto {
  id?: string
  username: string
  password?: string
  isSuperAdmin?: boolean
  status?: 'active' | 'disabled'
}

export function getUsers(page: number = 1, limit: number = 15) {
  return request({
    url: '/users',
    method: 'get',
    params: { page, limit }
  }) as Promise<any>
}

export function createUser(data: UserDto) {
  return request({
    url: '/users',
    method: 'post',
    data,
  }) as Promise<any>
}

export function updateUserStatus(id: string, status: 'active' | 'disabled') {
  return request({
    url: `/users/${id}/status`,
    method: 'put',
    data: { status }
  }) as Promise<any>
}

export function updateUser(id: string, data: UserDto) {
  return request({
    url: `/users/${id}`,
    method: 'put',
    data
  }) as Promise<any>
}

export function deleteUser(id: string) {
  return request({
    url: `/users/${id}`,
    method: 'delete',
  }) as Promise<any>
}
