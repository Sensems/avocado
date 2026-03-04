import { defineStore } from 'pinia'
import { ref } from 'vue'
import { login as loginApi, getUserInfo as getUserInfoApi } from '@/api/auth'
import type { LoginDto } from '@/api/auth'
import router from '@/router'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('avocado-token'))
  const userInfo = ref<any>(null)

  const login = async (payload: LoginDto) => {
    try {
      const res = await loginApi(payload)
      console.log("🚀 ~ login ~ res:", res)
      token.value = res.data.accessToken
      console.log("🚀 ~ login ~ token:", token)
      localStorage.setItem('avocado-token', res.data.accessToken)
      await fetchUserInfo()
      router.push('/dashboard')
    } catch (error) {
      console.error('Login failed', error)
      throw error
    }
  }

  const logout = () => {
    token.value = null
    userInfo.value = null
    localStorage.removeItem('avocado-token')
    router.replace('/login')
  }

  const fetchUserInfo = async () => {
    try {
      if (!token.value) return
      const res = await getUserInfoApi()
      userInfo.value = res.data
    } catch (error) {
      console.error('Fetch user info failed', error)
      logout()
    }
  }

  return {
    token,
    userInfo,
    login,
    logout,
    fetchUserInfo
  }
}, {
  persist: true
})
