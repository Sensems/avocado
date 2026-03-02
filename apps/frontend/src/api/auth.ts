import request from '@/utils/request'

export interface LoginDto {
  username: string
  password?: string
}

export function login(data: LoginDto) {
  return request({
    url: '/auth/login',
    method: 'post',
    data,
  }) as Promise<any>
}

export function getUserInfo() {
  return request({
    url: '/auth/profile',
    method: 'get',
  }) as Promise<any>
}
