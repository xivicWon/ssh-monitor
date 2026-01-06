<script setup lang="ts">
import { computed, watch, ref, nextTick, onUnmounted } from 'vue'
import { useConnectionStore } from '@/stores/connectionStore'
import { useSshConnection } from '@/composables'

const connectionStore = useConnectionStore()
const { getServerInfo, isLoadingInfo } = useSshConnection()

const activeConnection = computed(() => connectionStore.activeConnection)
const serverInfo = computed(() => connectionStore.serverInfo)
const commandHistory = computed(() => connectionStore.commandHistory)
const lastRefreshed = ref<string | null>(null)
const historyListRef = ref<HTMLElement | null>(null)

// 리사이즈 관련
const rightPanelRef = ref<HTMLElement | null>(null)
const serverSectionRef = ref<HTMLElement | null>(null)
const historyHeight = ref(200)
const isResizing = ref(false)
const MIN_HISTORY_HEIGHT = 100

function startResize(e: MouseEvent) {
  isResizing.value = true
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  e.preventDefault()
}

function handleResize(e: MouseEvent) {
  if (!isResizing.value || !rightPanelRef.value || !serverSectionRef.value) return

  const panelRect = rightPanelRef.value.getBoundingClientRect()
  const serverRect = serverSectionRef.value.getBoundingClientRect()

  // 패널 하단에서 마우스까지의 거리 = 새 히스토리 높이
  const newHeight = panelRect.bottom - e.clientY

  // 서버 정보 영역의 높이 (헤더 제외)
  const maxHeight = serverRect.height - 50

  // 제약 조건: 최소 100px, 최대 서버정보 영역 높이
  historyHeight.value = Math.max(MIN_HISTORY_HEIGHT, Math.min(newHeight, maxHeight))
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
}

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
})

// 히스토리 추가 시 자동 스크롤
watch(commandHistory, async () => {
  await nextTick()
  if (historyListRef.value) {
    historyListRef.value.scrollTop = historyListRef.value.scrollHeight
  }
}, { deep: true })

async function refreshServerInfo() {
  const conn = activeConnection.value
  if (!conn) return

  const info = await getServerInfo(conn)
  if (info) {
    connectionStore.setServerInfo(info)
    lastRefreshed.value = new Date().toLocaleTimeString()
  }
}

watch(activeConnection, async (newConn) => {
  if (newConn) {
    connectionStore.setServerInfo(null)
    await refreshServerInfo()
  } else {
    connectionStore.setServerInfo(null)
    lastRefreshed.value = null
  }
}, { immediate: true })
</script>

<template>
  <div ref="rightPanelRef" class="right-panel">
    <div class="panel-header">
      <h3>서버 정보</h3>
      <button
        v-if="activeConnection"
        class="refresh-btn"
        :disabled="isLoadingInfo"
        @click="refreshServerInfo"
        title="새로고침"
      >
        {{ isLoadingInfo ? '...' : '↻' }}
      </button>
    </div>

    <!-- 서버 정보 섹션 -->
    <div ref="serverSectionRef" class="server-section">
      <div v-if="!activeConnection" class="empty-state">
        <p>연결을 선택하세요</p>
      </div>

      <div v-else-if="isLoadingInfo && !serverInfo" class="loading-state">
        <p>정보 로딩 중...</p>
      </div>

      <div v-else-if="serverInfo" class="server-info">
        <div class="info-item">
          <span class="info-label">호스트명</span>
          <span class="info-value">{{ serverInfo.hostname }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">OS</span>
          <span class="info-value">{{ serverInfo.osType }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">버전</span>
          <span class="info-value">{{ serverInfo.osVersion }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Uptime</span>
          <span class="info-value">{{ serverInfo.uptime }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">CPU</span>
          <span class="info-value">{{ serverInfo.cpuCores }} cores</span>
        </div>
        <div class="info-item">
          <span class="info-label">메모리</span>
          <span class="info-value">{{ serverInfo.memoryTotal }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">디스크</span>
          <span class="info-value">{{ serverInfo.diskUsage }}</span>
        </div>

        <div v-if="lastRefreshed" class="last-updated">
          마지막 업데이트: {{ lastRefreshed }}
        </div>
      </div>

      <div v-else class="error-state">
        <p>정보를 불러올 수 없습니다</p>
        <button @click="refreshServerInfo">재시도</button>
      </div>
    </div>

    <!-- 리사이즈 핸들 -->
    <div
      class="resize-handle"
      :class="{ resizing: isResizing }"
      @mousedown="startResize"
    >
      <div class="resize-line" />
    </div>

    <!-- 명령어 히스토리 -->
    <div class="history-section" :style="{ height: historyHeight + 'px' }">
      <div class="history-header">
        <h3>명령어 히스토리</h3>
        <button
          v-if="commandHistory.length > 0"
          class="clear-btn"
          @click="connectionStore.clearHistory"
          title="히스토리 지우기"
        >
          ✕
        </button>
      </div>
      <div ref="historyListRef" class="history-list">
        <div
          v-for="(item, index) in commandHistory"
          :key="index"
          class="history-item"
          @click="connectionStore.setPendingCommand(item.command)"
          title="클릭하여 터미널에 입력"
        >
          <span class="history-command">{{ item.command }}</span>
          <span class="history-time">{{ item.timestamp.toLocaleTimeString() }}</span>
        </div>
        <div v-if="commandHistory.length === 0" class="history-empty">
          입력한 명령어가 여기에 표시됩니다
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.right-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-secondary);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border);
}

.panel-header h3 {
  font-size: 14px;
  font-weight: 600;
}

.refresh-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  font-size: 16px;
  background: transparent;
}

.server-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.empty-state,
.loading-state,
.error-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  color: var(--color-text-muted);
  text-align: center;
}

.error-state button {
  margin-top: 12px;
}

.server-info {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.info-item {
  margin-bottom: 12px;
}

.info-label {
  display: block;
  font-size: 11px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  margin-bottom: 2px;
}

.info-value {
  font-size: 13px;
  color: var(--color-text-primary);
  word-break: break-all;
}

.last-updated {
  margin-top: 20px;
  padding-top: 12px;
  border-top: 1px solid var(--color-border);
  font-size: 11px;
  color: var(--color-text-muted);
  text-align: center;
}

/* 리사이즈 핸들 */
.resize-handle {
  height: 8px;
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-secondary);
  border-top: 1px solid var(--color-border);
  transition: background-color 0.15s;
}

.resize-handle:hover,
.resize-handle.resizing {
  background: var(--color-bg-tertiary);
}

.resize-line {
  width: 40px;
  height: 3px;
  background: var(--color-text-muted);
  border-radius: 2px;
  opacity: 0.5;
}

.resize-handle:hover .resize-line,
.resize-handle.resizing .resize-line {
  opacity: 1;
  background: var(--color-accent);
}

/* 명령어 히스토리 */
.history-section {
  display: flex;
  flex-direction: column;
  min-height: 100px;
  flex-shrink: 0;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
}

.history-header h3 {
  font-size: 12px;
  font-weight: 600;
  color: var(--color-text-secondary);
}

.clear-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  font-size: 12px;
  background: transparent;
  color: var(--color-text-muted);
}

.clear-btn:hover {
  color: var(--color-error);
  background: transparent;
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.history-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 6px 8px;
  margin-bottom: 4px;
  background: var(--color-bg-tertiary);
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.history-item:hover {
  background: var(--color-accent);
}

.history-item:hover .history-command {
  color: var(--color-bg-primary);
}

.history-item:hover .history-time {
  color: var(--color-bg-secondary);
}

.history-command {
  flex: 1;
  font-family: monospace;
  color: var(--color-text-primary);
  word-break: break-all;
  margin-right: 8px;
}

.history-time {
  flex-shrink: 0;
  color: var(--color-text-muted);
  font-size: 10px;
}

.history-empty {
  text-align: center;
  padding: 20px 10px;
  color: var(--color-text-muted);
  font-size: 11px;
}
</style>
