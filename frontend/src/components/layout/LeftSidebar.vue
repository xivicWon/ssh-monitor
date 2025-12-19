<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useConnectionStore } from '@/stores/connectionStore'
import ConnectionItem from '../connection/ConnectionItem.vue'
import ConnectionForm from '../connection/ConnectionForm.vue'
import DirectoryBrowser from '../directory/DirectoryBrowser.vue'
import type { DirectoryEntry } from '@/types'

const connectionStore = useConnectionStore()
const showForm = ref(false)
const editingId = ref<string | null>(null)

const connections = computed(() => connectionStore.connections)
const activeConnectionId = computed(() => connectionStore.activeConnectionId)
const isConnected = computed(() => !!connectionStore.activeConnectionId && !!connectionStore.serverInfo)

// 리사이즈 관련 상태
const MIN_SECTION_HEIGHT = 100
const connectionSectionRef = ref<HTMLElement | null>(null)
const directoryHeight = ref(200)
const isResizing = ref(false)
const panelRect = ref<DOMRect | null>(null)

function handleAddNew() {
  editingId.value = null
  showForm.value = true
}

function handleEdit(id: string) {
  editingId.value = id
  showForm.value = true
}

function handleFormClose() {
  showForm.value = false
  editingId.value = null
}

function handleSelect(id: string) {
  connectionStore.setActiveConnection(id)
}

function handleDelete(id: string) {
  if (confirm('이 연결을 삭제하시겠습니까?')) {
    connectionStore.removeConnection(id)
  }
}

function handleClearCredentials(id: string) {
  if (confirm('저장된 비밀번호를 삭제하시겠습니까?')) {
    connectionStore.clearConnectionCredentials(id)
  }
}

function handleNavigate(path: string) {
  connectionStore.setPendingDirectoryPath(path)
}

function handleSelectFile(entry: DirectoryEntry) {
  // 파일 선택 시 cd 명령어로 해당 디렉토리 이동 후 파일 열기 등의 동작 가능
  // 일단은 콘솔에 로그만 출력
  console.log('Selected file:', entry)
}

// 리사이즈 핸들러
function startResize(e: MouseEvent) {
  e.preventDefault()
  isResizing.value = true

  const sidebar = connectionSectionRef.value?.closest('.left-sidebar')
  if (sidebar) {
    panelRect.value = sidebar.getBoundingClientRect()
  }

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
}

function handleResize(e: MouseEvent) {
  if (!isResizing.value || !panelRect.value) return

  const newHeight = panelRect.value.bottom - e.clientY - 50 // 50 = header height approximate
  const maxHeight = panelRect.value.height - MIN_SECTION_HEIGHT - 100 // connection 영역 최소 유지

  directoryHeight.value = Math.max(MIN_SECTION_HEIGHT, Math.min(newHeight, maxHeight))
}

function stopResize() {
  isResizing.value = false
  panelRect.value = null
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

onUnmounted(() => {
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<template>
  <div class="left-sidebar">
    <!-- 연결 목록 영역 (상단) -->
    <div class="connection-section" ref="connectionSectionRef">
      <div class="sidebar-header">
        <h2>SSH 연결</h2>
        <button class="add-btn" @click="handleAddNew" title="새 연결 추가">
          <span>+</span>
        </button>
      </div>

      <div class="connection-list">
        <ConnectionItem
          v-for="conn in connections"
          :key="conn.id"
          :connection="conn"
          :isActive="conn.id === activeConnectionId"
          @select="handleSelect"
          @edit="handleEdit"
          @delete="handleDelete"
          @clearCredentials="handleClearCredentials"
        />
        <div v-if="connections.length === 0" class="empty-state">
          <p>연결이 없습니다</p>
          <button @click="handleAddNew">새 연결 추가</button>
        </div>
      </div>
    </div>

    <!-- 리사이즈 핸들 -->
    <div
      class="resize-handle"
      :class="{ active: isResizing }"
      @mousedown="startResize"
    >
      <div class="handle-bar"></div>
    </div>

    <!-- 디렉토리 브라우저 영역 (하단) -->
    <div
      class="directory-section"
      :style="{ height: directoryHeight + 'px' }"
    >
      <DirectoryBrowser
        v-if="isConnected"
        @navigate="handleNavigate"
        @selectFile="handleSelectFile"
      />
      <div v-else class="directory-placeholder">
        <p>SSH 연결 후 디렉토리를 탐색할 수 있습니다</p>
      </div>
    </div>

    <ConnectionForm
      v-if="showForm"
      :editingId="editingId"
      @close="handleFormClose"
    />
  </div>
</template>

<style scoped>
.left-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-secondary);
}

.connection-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 100px;
  overflow: hidden;
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.sidebar-header h2 {
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.add-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  border-radius: 4px;
}

.connection-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-text-muted);
}

.empty-state p {
  margin-bottom: 16px;
}

/* 리사이즈 핸들 */
.resize-handle {
  height: 6px;
  background: var(--color-bg-tertiary);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  cursor: ns-resize;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.resize-handle:hover,
.resize-handle.active {
  background: var(--color-primary);
}

.handle-bar {
  width: 40px;
  height: 2px;
  background: var(--color-text-muted);
  border-radius: 1px;
}

.resize-handle:hover .handle-bar,
.resize-handle.active .handle-bar {
  background: white;
}

/* 디렉토리 섹션 */
.directory-section {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border-top: 1px solid var(--color-border);
}

.directory-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-muted);
  font-size: 12px;
  text-align: center;
  padding: 20px;
}
</style>
