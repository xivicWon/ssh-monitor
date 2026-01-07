import { ref } from 'vue'

export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
export type LogCategory = 'WebSocket' | 'Ping' | 'Terminal' | 'Connection' | 'Store' | 'General'

export interface LogEntry {
  timestamp: string
  level: LogLevel
  category: LogCategory
  message: string
  data?: string
  sessionId: string
}

const STORAGE_KEY = 'ssh-monitor-logs'
const MAX_LOG_SIZE = 4 * 1024 * 1024 // 4MB (localStorage 제한 5MB 고려)
const MAX_LOGS = 100 // 최대 로그 개수 (localStorage에 저장할 개수)
const SEND_INTERVAL = 10000 // 10초
const SEND_THRESHOLD = 50 // 50개 이상이면 즉시 전송
const MAX_RETRY = 3 // 최대 재시도 횟수

// 싱글톤 상태
const logs = ref<LogEntry[]>([])
const isEnabled = ref(true)
const browserSessionId = ref<string>('')

// 브라우저 세션 ID 초기화 (sessionStorage)
function initBrowserSessionId() {
  const stored = sessionStorage.getItem('ssh-monitor-session-id')
  if (stored) {
    browserSessionId.value = stored
  } else {
    browserSessionId.value = crypto.randomUUID()
    sessionStorage.setItem('ssh-monitor-session-id', browserSessionId.value)
  }
}

// 주기적 전송 타이머
let sendTimer: number | null = null

// 백엔드로 로그 전송
async function sendLogsToBackend(retryCount = 0): Promise<boolean> {
  if (logs.value.length === 0) return true

  try {
    // 로그 정규화: data 필드가 객체인 경우 문자열로 변환
    const normalizedLogs = logs.value.map(log => ({
      ...log,
      data: typeof log.data === 'object' ? JSON.stringify(log.data) : log.data
    }))

    const API_URL = import.meta.env.VITE_API_URL || '/api'
    const response = await fetch(`${API_URL}/frontend-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(normalizedLogs)
    })

    if (response.ok) {
      // 전송 성공 시 localStorage에서 삭제
      logs.value = []
      localStorage.removeItem(STORAGE_KEY)
      return true
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (error) {
    if (retryCount < MAX_RETRY) {
      // Exponential backoff: 1초, 2초, 4초
      const delay = Math.pow(2, retryCount) * 1000
      await new Promise(resolve => setTimeout(resolve, delay))
      return sendLogsToBackend(retryCount + 1)
    } else {
      // 최대 재시도 횟수 초과 시 콘솔에만 경고
      if (import.meta.env.DEV) {
        console.warn('Failed to send logs to backend after', MAX_RETRY, 'retries:', error)
      }
      return false
    }
  }
}

// 주기적 전송 시작
function startPeriodicSend() {
  if (sendTimer !== null) return

  sendTimer = window.setInterval(() => {
    if (logs.value.length > 0) {
      sendLogsToBackend()
    }
  }, SEND_INTERVAL)
}

// 주기적 전송 중지
function stopPeriodicSend() {
  if (sendTimer !== null) {
    clearInterval(sendTimer)
    sendTimer = null
  }
}

// localStorage에서 로그 로드
function loadLogsFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) {
        // 로그 정규화: data 필드가 객체인 경우 문자열로 변환
        logs.value = parsed.map(log => ({
          ...log,
          data: typeof log.data === 'object' && log.data !== null
            ? JSON.stringify(log.data)
            : log.data
        }))
      }
    }
  } catch (e) {
    console.error('Failed to load logs from storage:', e)
  }
}

// localStorage에 로그 저장
function saveLogsToStorage() {
  try {
    const serialized = JSON.stringify(logs.value)
    // 크기 체크
    if (serialized.length > MAX_LOG_SIZE) {
      // 오래된 로그부터 삭제
      const half = Math.floor(logs.value.length / 2)
      logs.value = logs.value.slice(half)
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.value))
  } catch (e) {
    console.error('Failed to save logs to storage:', e)
    // localStorage 용량 초과 시 오래된 로그 삭제 후 재시도
    if (e instanceof Error && e.name === 'QuotaExceededError') {
      const half = Math.floor(logs.value.length / 2)
      logs.value = logs.value.slice(half)
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(logs.value))
      } catch (retryError) {
        console.error('Failed to save logs after cleanup:', retryError)
      }
    }
  }
}

// 로그 추가 (내부 함수)
function addLog(level: LogLevel, category: LogCategory, message: string, data?: any) {
  if (!isEnabled.value) return

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    data: data ? JSON.stringify(data) : undefined,
    sessionId: browserSessionId.value
  }

  logs.value.push(entry)

  // 최대 개수 초과 시 오래된 로그 삭제
  if (logs.value.length > MAX_LOGS) {
    logs.value = logs.value.slice(-MAX_LOGS)
  }

  saveLogsToStorage()

  // 개발 모드에서는 콘솔에도 출력
  if (import.meta.env.DEV) {
    const timestamp = new Date().toLocaleTimeString()
    const prefix = `[${timestamp}] [${level}] [${category}]`
    const dataOutput = entry.data || ''

    switch (level) {
      case 'DEBUG':
        console.debug(prefix, message, dataOutput)
        break
      case 'INFO':
        console.info(prefix, message, dataOutput)
        break
      case 'WARN':
        console.warn(prefix, message, dataOutput)
        break
      case 'ERROR':
        console.error(prefix, message, dataOutput)
        break
    }
  }

  // 50개 이상 쌓이면 즉시 전송
  if (logs.value.length >= SEND_THRESHOLD) {
    sendLogsToBackend()
  }
}

export function useLogger() {
  // 초기화: 한 번만 로드
  if (!browserSessionId.value) {
    initBrowserSessionId()
    loadLogsFromStorage()
    startPeriodicSend()
  }

  // 로그 레벨별 함수
  function debug(category: LogCategory, message: string, data?: any) {
    addLog('DEBUG', category, message, data)
  }

  function info(category: LogCategory, message: string, data?: any) {
    addLog('INFO', category, message, data)
  }

  function warn(category: LogCategory, message: string, data?: any) {
    addLog('WARN', category, message, data)
  }

  function error(category: LogCategory, message: string, data?: any) {
    addLog('ERROR', category, message, data)
  }

  // 로그 다운로드 (JSON 형식)
  function downloadLogsAsJson() {
    const dataStr = JSON.stringify(logs.value, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ssh-monitor-logs-${formatDateForFilename()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // 로그 다운로드 (TXT 형식)
  function downloadLogsAsTxt() {
    const lines = logs.value.map(log => {
      const timestamp = new Date(log.timestamp).toLocaleString()
      const dataStr = log.data ? ` ${log.data}` : ''
      return `[${timestamp}] [${log.level}] [${log.category}] ${log.message}${dataStr}`
    })
    const dataStr = lines.join('\n')
    const dataBlob = new Blob([dataStr], { type: 'text/plain' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `ssh-monitor-logs-${formatDateForFilename()}.txt`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // 로그 클리어
  function clearLogs() {
    logs.value = []
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch (e) {
      console.error('Failed to clear logs from storage:', e)
    }
  }

  // 로그 활성화/비활성화
  function setEnabled(enabled: boolean) {
    isEnabled.value = enabled
  }

  // 로그 통계
  function getLogStats() {
    return {
      total: logs.value.length,
      debug: logs.value.filter(l => l.level === 'DEBUG').length,
      info: logs.value.filter(l => l.level === 'INFO').length,
      warn: logs.value.filter(l => l.level === 'WARN').length,
      error: logs.value.filter(l => l.level === 'ERROR').length,
      sizeKB: Math.round((JSON.stringify(logs.value).length) / 1024)
    }
  }

  // 파일명용 날짜 포맷
  function formatDateForFilename() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')
    return `${year}${month}${day}-${hour}${minute}${second}`
  }

  return {
    logs,
    isEnabled,
    browserSessionId,
    debug,
    info,
    warn,
    error,
    downloadLogsAsJson,
    downloadLogsAsTxt,
    clearLogs,
    setEnabled,
    getLogStats,
    sendLogsToBackend,
    stopPeriodicSend
  }
}
