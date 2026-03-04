import { ref, watchEffect, computed } from 'vue'
import { darkTheme, type GlobalTheme } from 'naive-ui'

type ThemeMode = 'dark' | 'light'

// 模块级单例状态，确保整个应用共享同一份主题
const themeMode = ref<ThemeMode>(
  (localStorage.getItem('theme') as ThemeMode) ?? 'dark'
)

// 同步 <html> 的 class，供全局 CSS 选择器使用
watchEffect(() => {
  const html = document.documentElement
  if (themeMode.value === 'dark') {
    html.classList.add('dark')
    html.classList.remove('light')
  } else {
    html.classList.add('light')
    html.classList.remove('dark')
  }
  localStorage.setItem('theme', themeMode.value)
})

export function useTheme() {
  // computed 保证响应式追踪 themeMode 的变化
  const naiveTheme = computed<GlobalTheme | null>(() =>
    themeMode.value === 'dark' ? darkTheme : null
  )

  const isDark = computed(() => themeMode.value === 'dark')

  function toggleTheme() {
    themeMode.value = themeMode.value === 'dark' ? 'light' : 'dark'
  }

  return { naiveTheme, isDark, toggleTheme }
}
