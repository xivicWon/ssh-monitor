<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useConnectionStore } from '@/stores/connectionStore'
import { useWebSocket } from '@/composables'

const emit = defineEmits<{
  close: []
}>()

const connectionStore = useConnectionStore()
const { sendInput } = useWebSocket()
const { activeSession } = storeToRefs(connectionStore)

// 활성 세션의 명령어 히스토리
const commandHistory = computed(() => activeSession.value?.commandHistory || [])
const historyListRef = ref<HTMLElement | null>(null)

watch(commandHistory, async () => {
  await nextTick()
  if (historyListRef.value) {
    historyListRef.value.scrollTop = historyListRef.value.scrollHeight
  }
}, { deep: true })

function handleSelect(command: string) {
  // 활성 세션이 있고 연결된 상태면 직접 전송
  if (activeSession.value && activeSession.value.status === 'connected') {
    sendInput({ sessionId: activeSession.value.sessionId, data: command + '\r' })
    connectionStore.addSessionCommand(activeSession.value.id, command)
  }
  emit('close')
}

function handleClearHistory() {
  if (activeSession.value) {
    connectionStore.clearSessionHistory(activeSession.value.id)
  }
}
</script>

<template>
  <div class="history-panel">
    <div class="panel-header">
      <h3>명령어 히스토리</h3>
      <div class="header-actions">
        <button
          v-if="commandHistory.length > 0"
          class="clear-btn"
          @click="handleClearHistory"
          title="전체 삭제"
        >
          삭제
        </button>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>
    </div>

    <div ref="historyListRef" class="history-list">
      <div
        v-for="(item, index) in commandHistory"
        :key="index"
        class="history-item"
        @click="handleSelect(item.command)"
        title="클릭하여 터미널에 입력"
      >
        <span class="history-command">{{ item.command }}</span>
        <span class="history-time">{{ item.timestamp.toLocaleTimeString() }}</span>
      </div>
      <div v-if="commandHistory.length === 0" class="history-empty">
        <p>입력한 명령어가</p>
        <p>여기에 표시됩니다</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.history-panel {
  position: absolute;
  top: 0;
  right: 0;
  width: 280px;
  height: 100%;
  background: rgba(20, 20, 20, 0.75);
  backdrop-filter: blur(12px);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
}

.panel-header h3 {
  font-size: 13px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.clear-btn {
  padding: 4px 8px;
  font-size: 11px;
  background: transparent;
  color: rgba(255, 100, 100, 0.8);
  border: 1px solid rgba(255, 100, 100, 0.4);
  border-radius: 4px;
}

.clear-btn:hover {
  background: rgba(255, 100, 100, 0.2);
  color: #ff6b6b;
}

.close-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  background: transparent;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.5);
  border-radius: 4px;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.8);
}

.history-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.history-item {
  display: flex;
  flex-direction: column;
  padding: 10px 12px;
  margin-bottom: 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.history-item:hover {
  background: rgba(255, 255, 255, 0.12);
}

.history-command {
  font-family: monospace;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  word-break: break-all;
  margin-bottom: 4px;
}

.history-time {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
}

.history-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(255, 255, 255, 0.3);
  font-size: 12px;
  text-align: center;
}

.history-empty p {
  margin: 2px 0;
}
</style>
