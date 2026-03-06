import request from '@/utils/request'

export interface AuditLogDto {
  id: string
  userId: string
  username: string
  action: string
  resource?: string
  targetId?: string
  ipAddress: string
  createdAt: string
  details?: string
  /** Request body stored by audit interceptor (JSON string or object) */
  changes?: unknown
}

export function getAuditLogs(params?: { 
  page?: number, 
  limit?: number, 
  userId?: string, 
  action?: string 
}) {
  return request({
    url: '/audit-logs',
    method: 'get',
    params
  }) as Promise<any>
}
