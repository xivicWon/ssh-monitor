<script setup lang="ts">
import { ref, computed } from 'vue'
import { useConnectionStore } from '@/stores/connectionStore'
import ConnectionItem from './ConnectionItem.vue'
import ConnectionForm from './ConnectionForm.vue'

const emit = defineEmits<{
  close: []
  select: [connectionId: string]
}>()

const connectionStore = useConnectionStore()
const showForm = ref(false)
const editingId = ref<string | null>(null)

const connections = computed(() => connectionStore.connections)
const activeConnectionId = computed(() => connectionStore.activeConnectionId)

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
  emit('select', id)
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

function handleOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains('popup-overlay')) {
    emit('close')
  }
}
</script>

<template>
  <div class="popup-overlay" @click="handleOverlayClick">
    <div class="popup-container">
      <div class="popup-header">
        <h2>SSH 연결</h2>
        <button class="close-btn" @click="emit('close')">✕</button>
      </div>

      <div class="popup-content">
        <!-- 연결 폼 (접기 가능) -->
        <ConnectionForm
          v-if="showForm"
          :editingId="editingId"
          @close="handleFormClose"
        />

        <!-- 연결 목록 -->
        <div class="connection-section">
          <div class="section-header">
            <span>연결 목록</span>
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
            <div v-if="connections.length === 0 && !showForm" class="empty-state">
              <p>연결이 없습니다</p>
              <button @click="handleAddNew">새 연결 추가</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  backdrop-filter: blur(4px);
}

.popup-container {
  background: var(--color-bg-secondary);
  border-radius: 12px;
  width: 90%;
  max-width: 480px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}

.popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.popup-header h2 {
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  background: transparent;
  font-size: 18px;
  color: var(--color-text-muted);
  border-radius: 6px;
}

.close-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.popup-content {
  flex: 1;
  overflow-y: auto;
}

.connection-section {
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  background: var(--color-bg-tertiary);
  border-bottom: 1px solid var(--color-border);
}

.add-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  border-radius: 4px;
}

.connection-list {
  padding: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--color-text-muted);
}

.empty-state p {
  margin-bottom: 16px;
}
</style>
