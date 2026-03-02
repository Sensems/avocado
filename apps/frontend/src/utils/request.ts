import axios from 'axios'
import { createDiscreteApi, darkTheme } from 'naive-ui'
import router from '@/router'

const { message } = createDiscreteApi(['message'], {
  configProviderProps: { theme: darkTheme }
})

const tokenKey = 'avocado-token'

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
    if (error.response) {
      switch (error.response.status) {
        case 401:
          message.error('Unauthorized, please log in.')
          localStorage.removeItem(tokenKey)
          router.push('/login')
          break
        case 403:
          message.error('Forbidden access.')
          break
        default:
          message.error(error.response.data?.message || 'Server Error')
      }
    } else {
      message.error('Network Error')
    }
    return Promise.reject(error)
  },
)

export default service
