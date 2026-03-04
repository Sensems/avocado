import request from '@/utils/request'

export interface DashboardStats {
  overview: {
    totalProjects: number
    totalUsers: number
    todayBuilds: number
    activeBuilds: number
  }
  buildTrends: Array<{
    date: string
    success: number
    failed: number
  }>
  frameworkDistribution: Array<{
    name: string
    value: number
  }>
  topProjects: Array<{
    id: string
    name: string
    buildCount: number
  }>
  recentActivity: Array<{
    id: string
    status: string
    version: string | null
    branch: string
    createdAt: string
    projectName: string
    triggerUser: string
  }>
}

export function getDashboardStats() {
  return request.get<{ data: DashboardStats }>('/dashboard/stats')
}
