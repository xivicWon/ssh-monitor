import { defineStore } from 'pinia'
import { ref } from 'vue'

export type Theme = 'dark' | 'light'

// 사용 가능한 폰트 목록 (인기순 정렬)
export const FONT_OPTIONS = [
  { id: 'jetbrains', name: 'JetBrains Mono', value: '"JetBrains Mono", monospace', desc: 'JetBrains IDE 기본 폰트' },
  { id: 'fira', name: 'Fira Code', value: '"Fira Code", monospace', desc: '리거처 지원, 가독성 최고' },
  { id: 'source', name: 'Source Code Pro', value: '"Source Code Pro", monospace', desc: 'Adobe 오픈소스' },
  { id: 'ibm', name: 'IBM Plex Mono', value: '"IBM Plex Mono", monospace', desc: 'IBM 공식 폰트' },
  { id: 'roboto', name: 'Roboto Mono', value: '"Roboto Mono", monospace', desc: 'Google 안드로이드 폰트' },
  { id: 'inconsolata', name: 'Inconsolata', value: '"Inconsolata", monospace', desc: '클래식 프로그래밍 폰트' },
  { id: 'ubuntu', name: 'Ubuntu Mono', value: '"Ubuntu Mono", monospace', desc: 'Ubuntu 기본 폰트' },
  { id: 'cascadia', name: 'Cascadia Code', value: '"Cascadia Code", Consolas, monospace', desc: 'Windows Terminal 기본' },
  { id: 'consolas', name: 'Consolas', value: 'Consolas, monospace', desc: 'Windows 기본' },
  { id: 'menlo', name: 'Menlo', value: 'Menlo, Monaco, monospace', desc: 'macOS 기본' },
] as const

export type FontId = typeof FONT_OPTIONS[number]['id']

// 폰트 사이즈 옵션
export const FONT_SIZE_OPTIONS = [10, 11, 12, 13, 14, 15, 16, 18, 20] as const
export type FontSize = typeof FONT_SIZE_OPTIONS[number]

const THEME_STORAGE_KEY = 'ssh-monitor-theme'
const FONT_STORAGE_KEY = 'ssh-monitor-font'
const FONT_SIZE_STORAGE_KEY = 'ssh-monitor-font-size'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref<Theme>('dark')
  const fontId = ref<FontId>('jetbrains')
  const fontSize = ref<FontSize>(14)

  // 현재 폰트 정보 가져오기
  function getCurrentFont() {
    return FONT_OPTIONS.find(f => f.id === fontId.value) || FONT_OPTIONS[0]
  }

  function loadTheme() {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
    if (stored && (stored === 'dark' || stored === 'light')) {
      theme.value = stored
    } else {
      // 시스템 다크 모드 확인
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      theme.value = prefersDark ? 'dark' : 'light'
    }
    applyTheme()
  }

  function loadFont() {
    const stored = localStorage.getItem(FONT_STORAGE_KEY) as FontId | null
    if (stored && FONT_OPTIONS.some(f => f.id === stored)) {
      fontId.value = stored
    }
    applyFont()
  }

  function loadFontSize() {
    const stored = localStorage.getItem(FONT_SIZE_STORAGE_KEY)
    if (stored) {
      const size = parseInt(stored) as FontSize
      if (FONT_SIZE_OPTIONS.includes(size)) {
        fontSize.value = size
      }
    }
    applyFontSize()
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme.value)
  }

  function applyFont() {
    const font = getCurrentFont()
    document.documentElement.style.setProperty('--font-mono', font.value)
  }

  function applyFontSize() {
    document.documentElement.style.setProperty('--font-size-mono', `${fontSize.value}px`)
  }

  function setTheme(newTheme: Theme) {
    theme.value = newTheme
    localStorage.setItem(THEME_STORAGE_KEY, newTheme)
    applyTheme()
  }

  function setFont(newFontId: FontId) {
    fontId.value = newFontId
    localStorage.setItem(FONT_STORAGE_KEY, newFontId)
    applyFont()
  }

  function setFontSize(newSize: FontSize) {
    fontSize.value = newSize
    localStorage.setItem(FONT_SIZE_STORAGE_KEY, String(newSize))
    applyFontSize()
  }

  function toggleTheme() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  // 시스템 테마 변경 감지
  function watchSystemTheme() {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      // 사용자가 명시적으로 테마를 설정하지 않은 경우에만 자동 변경
      if (!localStorage.getItem(THEME_STORAGE_KEY)) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    })
  }

  // 초기화
  loadTheme()
  loadFont()
  loadFontSize()
  watchSystemTheme()

  return {
    theme,
    fontId,
    fontSize,
    getCurrentFont,
    setTheme,
    setFont,
    setFontSize,
    toggleTheme
  }
})
