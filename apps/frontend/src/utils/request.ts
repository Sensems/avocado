import axios from 'axios'
import { createDiscreteApi, darkTheme } from 'naive-ui'
import router from '@/router'
import i18n from '@/i18n'

const { message } = createDiscreteApi(['message'], {
  configProviderProps: { theme: darkTheme }
})

const tokenKey = 'avocado-token'
/** 登录接口的 401 表示「账号或密码错误」，不是「登录态过期」，不能当会话失效处理 */
const isLoginRequest = (url?: string) => !!url && url.includes('/auth/login')

const service = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  timeout: 10000,
})

service.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(tokenKey)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error),
)

service.interceptors.response.use(
  (response) => {
    return response.data
  },
  (error) => {
    const t = i18n.global.t
    if (error.response) {
      const url = error.config?.url as string | undefined
      switch (error.response.status) {
        case 401:
          if (isLoginRequest(url)) {
            // 交给登录页提示，避免弹出「登录已过期」这种事不关己的文案，
            // 也避免把用户从登录页再踢回登录页
            break
          }
          message.error(t('common.sessionExpired'))
          localStorage.removeItem(tokenKey)
          router.push('/login')
          break
        case 403:
          message.error(error.response.data?.message || t('common.forbidden'))
          break
        default:
          message.error(error.response.data?.message || t('common.serverError'))
      }
    } else {
      message.error(t('common.networkError'))
    }
    return Promise.reject(error)
  },
)

export default service
