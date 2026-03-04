import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'

const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/login/index.vue'),
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('../views/dashboard/index.vue'),
  },
  {
    path: '/projects',
    name: 'Projects',
    component: () => import('../views/projects/index.vue'),
  },
  {
    path: '/projects/:id',
    name: 'ProjectDetail',
    component: () => import('../views/projects/[id].vue'),
  },
  {
    path: '/admin',
    component: () => import('../views/admin/index.vue'),
    redirect: '/admin/users',
    children: [
      {
        path: 'users',
        name: 'AdminUsers',
        component: () => import('../views/admin/users/index.vue'),
      },
      {
        path: 'credentials',
        name: 'AdminCredentials',
        component: () => import('../views/admin/credentials/index.vue'),
      },
      {
        path: 'robots',
        name: 'AdminRobots',
        component: () => import('../views/admin/robots/index.vue'),
      },
      {
        path: 'audit-logs',
        name: 'AuditLogs',
        component: () => import('../views/admin/audit-logs/index.vue'),
      },

    ]
  },
  {
    path: '/403',
    name: 'Forbidden',
    component: () => import('../views/error/403.vue'),
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to, _from, next) => {
  const token = localStorage.getItem('avocado_ci_token') || localStorage.getItem('avocado-token')
  
  // if navigating to login, allow
  if (to.path === '/login') {
    if (token) return next({ path: '/' }) // Already logged in
    return next()
  }
  
  // Route needs auth
  if (!token) {
    return next({ path: '/login', query: { redirect: to.fullPath } })
  }
  
  if (to.path.startsWith('/admin')) {
    const { useAuthStore } = await import('../store/auth')
    const authStore = useAuthStore()
    
    if (!authStore.userInfo) {
      try {
        await authStore.fetchUserInfo()
      } catch (e) {
        return next({ path: '/login' })
      }
    }

    if (!authStore.userInfo?.isSuperAdmin) {
      return next({ path: '/403' })
    }
  }

  next()
})

export default router
