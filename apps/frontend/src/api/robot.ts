import request from '@/utils/request'

export interface RobotDto {
  id?: string
  name: string
  platform: 'wecom' | 'dingtalk' | 'feishu'
  webhookUrl: string
  secret?: string
}

export function getRobots() {
  return request({
    url: '/im-robots',
    method: 'get',
  }) as Promise<any>
}

export function createRobot(data: RobotDto) {
  return request({
    url: '/im-robots',
    method: 'post',
    data,
  }) as Promise<any>
}

export function deleteRobot(id: string) {
  return request({
    url: `/im-robots/${id}`,
    method: 'delete',
  }) as Promise<any>
}

export function testRobot(id: string) {
  return request({
    url: `/im-robots/${id}/test`,
    method: 'post',
  }) as Promise<any>
}
