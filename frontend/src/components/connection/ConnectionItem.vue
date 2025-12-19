<script setup lang="ts">
import { computed } from 'vue'
import type { SshConnection } from '@/types'

const props = defineProps<{
  connection: SshConnection
  isActive: boolean
}>()

const emit = defineEmits<{
  select: [id: string]
  edit: [id: string]
  delete: [id: string]
  clearCredentials: [id: string]
}>()

const hasCredentials = computed(() =>
  !!(props.connection.password || props.connection.privateKey)
)

function handleClick() {
  emit('select', props.connection.id)
}

function handleEdit(e: Event) {
  e.stopPropagation()
  emit('edit', props.connection.id)
}

function handleDelete(e: Event) {
  e.stopPropagation()
  emit('delete', props.connection.id)
}

function handleClearCredentials(e: Event) {
  e.stopPropagation()
  emit('clearCredentials', props.connection.id)
}
</script>

<template>
  <div
    class="connection-item"
    :class="{ active: isActive }"
    @click="handleClick"
  >
    <div class="connection-info">
      <div class="connection-name">
        {{ connection.name }}
        <span v-if="hasCredentials" class="credential-indicator" title="비밀번호 저장됨"></span>
      </div>
      <div class="connection-details">
        {{ connection.username }}@{{ connection.host }}:{{ connection.port }}
      </div>
    </div>
    <div class="connection-actions">
      <button
        v-if="hasCredentials"
        class="action-btn clear-cred"
        @click="handleClearCredentials"
        title="비밀번호 초기화"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
        </svg>
      </button>
      <button class="action-btn" @click="handleEdit" title="편집">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
      <button class="action-btn delete" @click="handleDelete" title="삭제">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 6L6 18M6 6l12 12"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.connection-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  margin-bottom: 4px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.connection-item:hover {
  background: var(--color-bg-tertiary);
}

.connection-item.active {
  background: var(--color-accent);
  color: var(--color-bg-primary);
}

.connection-info {
  flex: 1;
  overflow: hidden;
}

.connection-name {
  font-weight: 500;
  margin-bottom: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.connection-details {
  font-size: 12px;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.connection-item.active .connection-details {
  color: var(--color-bg-tertiary);
}

.connection-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.connection-item:hover .connection-actions {
  opacity: 1;
}

.action-btn {
  width: 24px;
  height: 24px;
  padding: 0;
  font-size: 12px;
  background: transparent;
  border-radius: 4px;
}

.action-btn:hover {
  background: var(--color-bg-secondary);
}

.connection-item.active .action-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.action-btn.delete:hover {
  color: var(--color-error);
}

.action-btn.clear-cred:hover {
  color: var(--color-warning);
}

.action-btn svg {
  display: block;
}

.credential-indicator {
  display: inline-block;
  width: 6px;
  height: 6px;
  background: var(--color-success);
  border-radius: 50%;
  margin-left: 6px;
  vertical-align: middle;
}

.connection-item.active .credential-indicator {
  background: rgba(255, 255, 255, 0.8);
}
</style>
