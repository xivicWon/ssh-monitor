<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useConnectionStore } from '@/stores/connectionStore'
import { useThemeStore } from '@/stores/themeStore'
import { createTerminalInstance, type TerminalInstance } from '@/composables/useTerminalFactory'
import { useWebSocket, useSshConnection } from '@/composables'
import type { TerminalSession, TerminalMessage, DirectoryListResponse } from '@/types'

const props = defineProps<{
  session: TerminalSession
  isActive: boolean
}>()

const connectionStore = useConnectionStore()
const themeStore = useThemeStore()
const { theme, fontId, fontSize } = storeToRefs(themeStore)
const { getServerInfo } = useSshConnection()
const {
  isConnected: wsConnected,
  connect,
  subscribeToSession,
  subscribeToDirectory,
  subscribeToPwd,
  sendConnect,
  sendInput,
  sendResize,
  sendListDirectory,
  sendPwd,
  startPingTimer,
  handlePong,
  stopPingTimer,
  disconnectSession
} = useWebSocket()

const containerRef = ref<HTMLElement | null>(null)
const terminalInstance = ref<TerminalInstance | null>(null)
const commandBuffer = ref('')
const isInitialized = ref(false)

// 자동완성 상태
const showSuggestions = ref(false)
const selectedIndex = ref(0)

// 필터링된 제안 목록
const suggestions = computed(() => {
  if (!commandBuffer.value.trim()) return []
  const history = props.session.commandHistory || []
  const query = commandBuffer.value.toLowerCase()
  // 현재 입력과 일치하는 히스토리 필터링 (중복 제거)
  const commands = history.map(item => item.command)
  const filtered = [...new Set(commands)]
    .filter(cmd => cmd.toLowerCase().includes(query) && cmd !== commandBuffer.value)
    .slice(0, 8) // 최대 8개
  return filtered
})

// 연결 정보 가져오기
const connection = computed(() =>
  connectionStore.getConnectionById(props.session.connectionId)
)

// 터미널 메시지 핸들러
function handleTerminalMessage(message: TerminalMessage) {
  if (!terminalInstance.value) return

  switch (message.type) {
    case 'connected':
      connectionStore.updateSessionStatus(props.session.id, 'connected')
      terminalInstance.value.writeln('\r\n\x1b[32m✓ SSH 연결 성공\x1b[0m\r\n')

      // Ping 타이머 시작
      startPingTimer(props.session.sessionId, () => {
        connectionStore.updateSessionStatus(props.session.id, 'error')
        terminalInstance.value?.writeln('\r\n\x1b[31m✕ 연결 타임아웃\x1b[0m\r\n')
      })

      // 연결 성공 시 서버 정보 및 디렉토리 목록 요청
      setTimeout(async () => {
        connectionStore.setSessionLoadingDirectory(props.session.id, true)
        sendPwd(props.session.sessionId)

        // 서버 정보 가져오기
        if (connection.value) {
          const info = await getServerInfo(connection.value)
          if (info) {
            connectionStore.updateSessionServerInfo(props.session.id, info)
          }
        }
      }, 100)
      break

    case 'output':
      if (message.data) {
        terminalInstance.value.write(message.data)
      }
      break

    case 'error':
      connectionStore.updateSessionStatus(props.session.id, 'error')
      terminalInstance.value.writeln(`\r\n\x1b[31m✕ 오류: ${message.message}\x1b[0m\r\n`)
      break

    case 'disconnected':
      connectionStore.updateSessionStatus(props.session.id, 'disconnected')
      terminalInstance.value.writeln('\r\n\x1b[33m⚠ SSH 연결 종료\x1b[0m\r\n')
      break

    case 'status':
      if (message.status === 'disconnected') {
        connectionStore.updateSessionStatus(props.session.id, 'disconnected')
        terminalInstance.value.writeln(`\r\n\x1b[33m⚠ ${message.message || 'Session ended'}\x1b[0m\r\n`)
      }
      break

    case 'pong':
      handlePong(props.session.sessionId)
      if (message.data === 'false' || message.status === 'unhealthy') {
        connectionStore.updateSessionStatus(props.session.id, 'error')
        terminalInstance.value.writeln('\r\n\x1b[31m✕ 연결 상태 확인 실패\x1b[0m\r\n')
      }
      break

    case 'health_check':
      if (message.status === 'unhealthy') {
        connectionStore.updateSessionStatus(props.session.id, 'disconnected')
        terminalInstance.value.writeln('\r\n\x1b[33m⚠ 연결이 끊어졌습니다\x1b[0m\r\n')
      }
      break
  }
}

// 디렉토리 응답 핸들러
function handleDirectoryResponse(response: DirectoryListResponse) {
  connectionStore.setSessionLoadingDirectory(props.session.id, false)
  if (response.success) {
    connectionStore.setSessionDirectoryData(props.session.id, response.currentPath, response.entries)
  }
}

// PWD 응답 핸들러
function handlePwdResponse(path: string) {
  if (path) {
    connectionStore.setSessionLoadingDirectory(props.session.id, true)
    sendListDirectory({ sessionId: props.session.sessionId, path })
  }
}

// 자동완성 열기
function openSuggestions() {
  if (suggestions.value.length > 0) {
    showSuggestions.value = true
    selectedIndex.value = 0
  }
}

// 자동완성 닫기
function closeSuggestions() {
  showSuggestions.value = false
  selectedIndex.value = 0
}

// 선택된 명령어 적용
function applySuggestion(cmd: string) {
  if (!terminalInstance.value || props.session.status !== 'connected') return

  // 현재 입력 지우기 (backspace 전송)
  const deleteCount = commandBuffer.value.length
  for (let i = 0; i < deleteCount; i++) {
    sendInput({ sessionId: props.session.sessionId, data: '\x7f' })
  }

  // 선택한 명령어 입력
  sendInput({ sessionId: props.session.sessionId, data: cmd })
  commandBuffer.value = cmd
  closeSuggestions()
}

// 키보드 이벤트 핸들러 (화살표 키 인터셉트)
function handleCustomKeyEvent(event: KeyboardEvent): boolean {
  // 자동완성이 열려있을 때
  if (showSuggestions.value) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      selectedIndex.value = Math.min(selectedIndex.value + 1, suggestions.value.length - 1)
      return false
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
      return false
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      event.preventDefault()
      if (suggestions.value[selectedIndex.value]) {
        applySuggestion(suggestions.value[selectedIndex.value])
      }
      return false
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      closeSuggestions()
      return false
    }
  } else {
    // 자동완성이 닫혀있을 때 아래 화살표로 열기
    if (event.key === 'ArrowDown' && commandBuffer.value.trim()) {
      if (suggestions.value.length > 0) {
        event.preventDefault()
        openSuggestions()
        return false
      }
    }
  }
  return true
}

// SSH 연결 시작
async function connectToServer() {
  const conn = connection.value
  if (!conn || !terminalInstance.value) return

  connectionStore.updateSessionStatus(props.session.id, 'connecting')
  terminalInstance.value.clear()
  terminalInstance.value.writeln(`\x1b[36m연결 중: ${conn.username}@${conn.host}:${conn.port}\x1b[0m\r\n`)

  try {
    // WebSocket 연결 (이미 연결되어 있으면 스킵)
    if (!wsConnected.value) {
      await connect(handleTerminalMessage, () => {
        connectionStore.updateSessionStatus(props.session.id, 'error')
      })
    }

    // 세션 구독
    subscribeToSession(props.session.sessionId, handleTerminalMessage)
    subscribeToDirectory(props.session.sessionId, handleDirectoryResponse)
    subscribeToPwd(props.session.sessionId, handlePwdResponse)

    // SSH 연결 요청
    const { cols, rows } = terminalInstance.value.getDimensions()
    sendConnect({
      sessionId: props.session.sessionId,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      authType: conn.authType,
      password: conn.password,
      terminalConfig: { cols, rows, term: 'xterm-256color' }
    })
  } catch (e) {
    connectionStore.updateSessionStatus(props.session.id, 'error')
    terminalInstance.value.writeln(`\r\n\x1b[31m✕ WebSocket 연결 실패: ${e instanceof Error ? e.message : 'Unknown error'}\x1b[0m\r\n`)
  }
}

// 터미널 초기화
function initializeTerminal() {
  if (!containerRef.value || isInitialized.value) return

  terminalInstance.value = createTerminalInstance(containerRef.value, theme.value, fontSize.value)

  // 커스텀 키 이벤트 핸들러 등록 (화살표 키 인터셉트)
  terminalInstance.value.terminal.attachCustomKeyEventHandler(handleCustomKeyEvent)

  // 입력 핸들러
  terminalInstance.value.onData((data) => {
    if (props.session.status === 'connected') {
      sendInput({ sessionId: props.session.sessionId, data })

      // 명령어 버퍼 추적
      for (const char of data) {
        if (char === '\r' || char === '\n') {
          if (commandBuffer.value.trim()) {
            connectionStore.addSessionCommand(props.session.id, commandBuffer.value)
          }
          commandBuffer.value = ''
        } else if (char === '\x7f' || char === '\b') {
          commandBuffer.value = commandBuffer.value.slice(0, -1)
        } else if (char >= ' ' || char === '\t') {
          commandBuffer.value += char
        }
      }
    } else if (props.session.status === 'disconnected' || props.session.status === 'error') {
      // 연결이 끊어진 상태에서 키 입력 시 재연결 시도
      terminalInstance.value?.writeln('\r\n\x1b[33m⟳ 재연결 시도 중...\x1b[0m')
      connectToServer()
    }
  })

  // 리사이즈 핸들러
  terminalInstance.value.onResize(({ cols, rows }) => {
    if (props.session.status === 'connected') {
      sendResize({ sessionId: props.session.sessionId, cols, rows })
    }
  })

  terminalInstance.value.writeln('\x1b[36mSSH Monitor v1.0\x1b[0m')

  isInitialized.value = true

  // autoConnect 플래그가 true인 경우에만 자동 연결 (새로 생성된 세션)
  if (props.session.autoConnect) {
    terminalInstance.value.writeln('\x1b[90m연결을 시작합니다...\x1b[0m\r\n')
    nextTick(() => {
      connectToServer()
      // 한 번 연결 후에는 autoConnect 플래그 제거
      props.session.autoConnect = false
    })
  } else {
    // 복원된 세션의 경우, 사용자에게 안내 메시지 표시
    terminalInstance.value.writeln('\x1b[90m세션이 복원되었습니다.\x1b[0m')
    terminalInstance.value.writeln('\x1b[33m연결하려면 아무 키나 입력하세요.\x1b[0m\r\n')
  }
}

// 활성 상태 변경 시 fit 호출
watch(() => props.isActive, (active) => {
  if (active && terminalInstance.value) {
    nextTick(() => {
      terminalInstance.value?.fit()
      terminalInstance.value?.focus()
    })
  }
})

// 테마 변경 시 터미널 테마 업데이트
watch(theme, (newTheme) => {
  if (terminalInstance.value) {
    terminalInstance.value.setTheme(newTheme)
  }
})

// 폰트 변경 시 터미널 폰트 업데이트
watch(fontId, () => {
  if (terminalInstance.value) {
    const font = themeStore.getCurrentFont()
    terminalInstance.value.setFontFamily(font.value)
  }
})

// 폰트 크기 변경 시 터미널 폰트 크기 업데이트
watch(fontSize, (newSize) => {
  if (terminalInstance.value) {
    terminalInstance.value.setFontSize(newSize)
  }
})

// commandBuffer가 비워지면 자동완성 닫기
watch(commandBuffer, (newValue) => {
  if (!newValue.trim()) {
    closeSuggestions()
  }
})

// 컨테이너 리사이즈 감지
let resizeObserver: ResizeObserver | null = null

function setupResizeObserver() {
  if (!containerRef.value) return

  resizeObserver = new ResizeObserver(() => {
    if (terminalInstance.value) {
      // 사용자가 설정한 폰트 크기 유지, fit만 호출
      terminalInstance.value.fit()
    }
  })
  resizeObserver.observe(containerRef.value)
}

onMounted(() => {
  initializeTerminal()
  setupResizeObserver()
})

onUnmounted(() => {
  // Ping 타이머 정리
  stopPingTimer(props.session.sessionId)

  // ResizeObserver 정리
  resizeObserver?.disconnect()

  // 세션 연결 해제
  if (props.session.status === 'connected' || props.session.status === 'connecting') {
    disconnectSession(props.session.sessionId)
  }

  // 터미널 정리
  terminalInstance.value?.dispose()
})
</script>

<template>
  <div class="terminal-tab-wrapper">
    <div
      ref="containerRef"
      class="terminal-tab-container"
      @click="closeSuggestions"
    />
    <!-- 자동완성 드롭다운 -->
    <Transition name="fade">
      <div
        v-if="showSuggestions && suggestions.length > 0"
        class="autocomplete-dropdown"
      >
        <div class="autocomplete-header">
          <span>명령어 추천</span>
          <span class="autocomplete-hint">↑↓ 선택, Enter 적용, Esc 닫기</span>
        </div>
        <div class="autocomplete-list">
          <div
            v-for="(cmd, index) in suggestions"
            :key="index"
            class="autocomplete-item"
            :class="{ selected: index === selectedIndex }"
            @click.stop="applySuggestion(cmd)"
            @mouseenter="selectedIndex = index"
          >
            <span class="cmd-text">{{ cmd }}</span>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.terminal-tab-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}

.terminal-tab-container {
  width: 100%;
  height: 100%;
  padding: 4px;
  overflow: hidden;
  background: var(--color-bg-primary);
}

:deep(.xterm) {
  height: 100%;
}

:deep(.xterm-viewport) {
  overflow-y: auto !important;
}

/* 자동완성 드롭다운 */
.autocomplete-dropdown {
  position: absolute;
  bottom: 32px;
  left: 8px;
  right: 8px;
  max-width: 400px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(12px);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  z-index: 100;
  overflow: hidden;
}

[data-theme="light"] .autocomplete-dropdown {
  background: rgba(255, 255, 255, 0.9);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
}

.autocomplete-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  font-size: 11px;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
}

.autocomplete-hint {
  font-size: 10px;
  opacity: 0.7;
}

.autocomplete-list {
  max-height: 200px;
  overflow-y: auto;
}

.autocomplete-item {
  padding: 8px 12px;
  cursor: pointer;
  transition: background-color 0.15s;
  font-family: 'Cascadia Code', 'Fira Code', Consolas, Monaco, monospace;
  font-size: 13px;
}

.autocomplete-item:hover,
.autocomplete-item.selected {
  background: var(--color-accent);
  color: var(--color-bg-primary);
}

.cmd-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: block;
}

/* Transition */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s, transform 0.15s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>
