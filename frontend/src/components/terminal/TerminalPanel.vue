<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useConnectionStore } from '@/stores/connectionStore'
import { useTerminal, useWebSocket, useSshConnection } from '@/composables'
import type { TerminalMessage, ConnectionStatus, DirectoryListResponse } from '@/types'

const connectionStore = useConnectionStore()
const { initTerminal, write, writeln, clear, fit, getDimensions, onData, focus, dispose } = useTerminal()
const { isConnected, connect, subscribeToSession, subscribeToDirectory, subscribeToPwd, sendConnect, sendInput, sendResize, sendListDirectory, sendPwd, disconnect } = useWebSocket()
const { validateConnection, isValidating, error: connectionError } = useSshConnection()

const terminalRef = ref<HTMLElement | null>(null)
const status = ref<ConnectionStatus>('disconnected')
const sessionId = ref<string | null>(null)
const errorMessage = ref<string | null>(null)
const commandBuffer = ref('')

const { activeConnection, pendingCommand, pendingDirectoryPath, syncToTerminalRequested } = storeToRefs(connectionStore)

function handleDirectoryResponse(response: DirectoryListResponse) {
  connectionStore.setLoadingDirectory(false)
  if (response.success) {
    connectionStore.setDirectoryData(response.currentPath, response.entries)
  } else {
    console.error('Directory listing failed:', response.errorMessage)
  }
}

function handlePwdResponse(path: string) {
  if (path) {
    requestDirectoryListing(path)
  }
}

function requestDirectoryListing(path: string = '~') {
  if (sessionId.value && status.value === 'connected') {
    connectionStore.setLoadingDirectory(true)
    sendListDirectory({ sessionId: sessionId.value, path })
  }
}

function handleTerminalMessage(message: TerminalMessage) {
  switch (message.type) {
    case 'connected':
      status.value = 'connected'
      errorMessage.value = null
      writeln('\r\n\x1b[32m✓ SSH 연결 성공\x1b[0m\r\n')
      connectionStore.updateLastConnected(activeConnection.value!.id)
      // 연결 성공 시 터미널 현재 경로로 디렉토리 목록 요청
      setTimeout(() => {
        if (sessionId.value) {
          connectionStore.setLoadingDirectory(true)
          sendPwd(sessionId.value)
        }
      }, 100)
      break
    case 'output':
      if (message.data) {
        write(message.data)
      }
      break
    case 'error':
      status.value = 'error'
      errorMessage.value = message.message || 'Unknown error'
      writeln(`\r\n\x1b[31m✕ 오류: ${message.message}\x1b[0m\r\n`)
      break
    case 'disconnected':
      status.value = 'disconnected'
      writeln('\r\n\x1b[33m⚠ SSH 연결 종료\x1b[0m\r\n')
      break
    case 'status':
      if (message.status === 'disconnected') {
        status.value = 'disconnected'
        writeln(`\r\n\x1b[33m⚠ ${message.message || 'Session ended'}\x1b[0m\r\n`)
      }
      break
  }
}

async function connectToServer() {
  const conn = activeConnection.value
  if (!conn) return

  status.value = 'connecting'
  errorMessage.value = null
  clear()
  writeln(`\x1b[36m연결 중: ${conn.username}@${conn.host}:${conn.port}\x1b[0m\r\n`)

  try {
    await connect(handleTerminalMessage, (err) => {
      errorMessage.value = err.message
      status.value = 'error'
    })

    const newSessionId = crypto.randomUUID()
    sessionId.value = newSessionId

    subscribeToSession(newSessionId, handleTerminalMessage)
    subscribeToDirectory(newSessionId, handleDirectoryResponse)
    subscribeToPwd(newSessionId, handlePwdResponse)

    const { cols, rows } = getDimensions()
    sendConnect({
      sessionId: newSessionId,
      host: conn.host,
      port: conn.port,
      username: conn.username,
      authType: conn.authType,
      password: conn.password,
      privateKey: conn.privateKey,
      terminalConfig: {
        cols,
        rows,
        term: 'xterm-256color'
      }
    })
  } catch (e) {
    status.value = 'error'
    errorMessage.value = e instanceof Error ? e.message : 'Connection failed'
    writeln(`\r\n\x1b[31m✕ WebSocket 연결 실패: ${errorMessage.value}\x1b[0m\r\n`)
  }
}

function disconnectFromServer() {
  if (sessionId.value) {
    disconnect()
    sessionId.value = null
    status.value = 'disconnected'
    connectionStore.clearDirectoryData()
  }
}

function handleResize() {
  fit()
  if (sessionId.value && status.value === 'connected') {
    const { cols, rows } = getDimensions()
    sendResize({ sessionId: sessionId.value, cols, rows })
  }
}

watch(activeConnection, async (newConn, oldConn) => {
  if (oldConn && sessionId.value) {
    disconnectFromServer()
  }

  if (newConn) {
    await nextTick()
    if (!newConn.password && newConn.authType === 'password') {
      const password = prompt('비밀번호를 입력하세요:')
      if (password) {
        connectionStore.setConnectionCredentials(newConn.id, password)
      } else {
        return
      }
    }
    if (!newConn.privateKey && newConn.authType === 'privateKey') {
      alert('Private Key가 없습니다. 연결을 편집하여 추가해주세요.')
      return
    }
    connectToServer()
  }
}, { immediate: false })

// 히스토리에서 선택한 명령어 입력
watch(pendingCommand, (command) => {
  if (command && sessionId.value && status.value === 'connected') {
    // 터미널에 명령어 전송 (Enter 포함)
    sendInput({ sessionId: sessionId.value, data: command + '\r' })
    // 버퍼 초기화 및 히스토리에 추가
    commandBuffer.value = ''
    connectionStore.addCommand(command)
    // pending 상태 초기화
    connectionStore.setPendingCommand(null)
    // 터미널에 포커스
    focus()
  } else if (command) {
    // 연결되지 않은 상태에서 클릭한 경우
    connectionStore.setPendingCommand(null)
  }
})

// 디렉토리 탐색 요청 처리
watch(pendingDirectoryPath, (path) => {
  if (path && sessionId.value && status.value === 'connected') {
    requestDirectoryListing(path)
    connectionStore.setPendingDirectoryPath(null)
  } else if (path) {
    connectionStore.setPendingDirectoryPath(null)
  }
})

// 터미널 현재 경로로 동기화 요청 처리
watch(syncToTerminalRequested, (requested) => {
  console.log('[TerminalPanel] syncToTerminalRequested watch:', requested, 'sessionId:', sessionId.value, 'status:', status.value)
  if (requested && sessionId.value && status.value === 'connected') {
    console.log('[TerminalPanel] Sending pwd request for session:', sessionId.value)
    connectionStore.setLoadingDirectory(true)
    sendPwd(sessionId.value)
    connectionStore.clearSyncToTerminalRequest()
  } else if (requested) {
    console.log('[TerminalPanel] Cannot send pwd - not connected or no session')
    connectionStore.clearSyncToTerminalRequest()
  }
})

onMounted(() => {
  if (terminalRef.value) {
    initTerminal(terminalRef.value)
    onData((data) => {
      if (sessionId.value && status.value === 'connected') {
        sendInput({ sessionId: sessionId.value, data })

        // 명령어 히스토리 추적
        for (const char of data) {
          if (char === '\r' || char === '\n') {
            // Enter: 버퍼의 명령어를 히스토리에 저장
            if (commandBuffer.value.trim()) {
              connectionStore.addCommand(commandBuffer.value)
            }
            commandBuffer.value = ''
          } else if (char === '\x7f' || char === '\b') {
            // Backspace: 버퍼에서 마지막 문자 제거
            commandBuffer.value = commandBuffer.value.slice(0, -1)
          } else if (char >= ' ' || char === '\t') {
            // 출력 가능한 문자: 버퍼에 추가
            commandBuffer.value += char
          }
        }
      }
    })

    writeln('\x1b[36mSSH Monitor v1.0\x1b[0m')
    writeln('\x1b[90m왼쪽 사이드바에서 연결을 선택하세요.\x1b[0m\r\n')
    focus()
  }

  window.addEventListener('resize', handleResize)
})

onUnmounted(() => {
  disconnectFromServer()
  dispose()
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="terminal-panel">
    <div class="terminal-header">
      <div class="terminal-title">
        <span v-if="activeConnection">
          {{ activeConnection.name }}
          <span class="connection-info">
            ({{ activeConnection.username }}@{{ activeConnection.host }})
          </span>
        </span>
        <span v-else class="no-connection">터미널</span>
      </div>
      <div class="terminal-status">
        <span
          class="status-indicator"
          :class="status"
        />
        <span class="status-text">
          {{ status === 'connected' ? '연결됨' :
             status === 'connecting' ? '연결 중...' :
             status === 'error' ? '오류' : '연결 안됨' }}
        </span>
        <button
          v-if="status === 'connected'"
          class="disconnect-btn"
          @click="disconnectFromServer"
        >
          연결 끊기
        </button>
        <button
          v-else-if="activeConnection && status !== 'connecting'"
          class="connect-btn"
          @click="connectToServer"
        >
          재연결
        </button>
      </div>
    </div>
    <div ref="terminalRef" class="terminal-container" />
  </div>
</template>

<style scoped>
.terminal-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-primary);
}

.terminal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  height: var(--header-height);
}

.terminal-title {
  font-size: 14px;
  font-weight: 500;
}

.connection-info {
  font-size: 12px;
  color: var(--color-text-muted);
  margin-left: 8px;
}

.no-connection {
  color: var(--color-text-muted);
}

.terminal-status {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-indicator {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-muted);
}

.status-indicator.connected {
  background: var(--color-success);
}

.status-indicator.connecting {
  background: var(--color-warning);
  animation: pulse 1s infinite;
}

.status-indicator.error {
  background: var(--color-error);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.status-text {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.disconnect-btn,
.connect-btn {
  padding: 4px 12px;
  font-size: 12px;
}

.disconnect-btn {
  background: var(--color-error);
  color: white;
}

.disconnect-btn:hover {
  background: #e85c7a;
}

.connect-btn {
  background: var(--color-accent);
  color: var(--color-bg-primary);
}

.terminal-container {
  flex: 1;
  padding: 8px;
  overflow: hidden;
}

:deep(.xterm) {
  height: 100%;
}

:deep(.xterm-viewport) {
  overflow-y: auto !important;
}
</style>
