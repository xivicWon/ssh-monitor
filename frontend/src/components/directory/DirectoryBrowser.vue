<script setup lang="ts">
import { computed } from 'vue'
import { useConnectionStore } from '@/stores/connectionStore'
import type { DirectoryEntry } from '@/types'

const emit = defineEmits<{
  navigate: [path: string]
  selectFile: [entry: DirectoryEntry]
}>()

const connectionStore = useConnectionStore()

const currentPath = computed(() => connectionStore.currentPath)
const entries = computed(() => connectionStore.directoryEntries)
const isLoading = computed(() => connectionStore.isLoadingDirectory)

// 디렉토리 먼저, 그 다음 파일 (각각 알파벳 순)
const sortedEntries = computed(() => {
  return [...entries.value].sort((a, b) => {
    if (a.type === 'directory' && b.type !== 'directory') return -1
    if (a.type !== 'directory' && b.type === 'directory') return 1
    return a.name.localeCompare(b.name)
  })
})

function getParentPath(path: string): string {
  const parts = path.split('/').filter(Boolean)
  parts.pop()
  return '/' + parts.join('/')
}

function handleEntryClick(entry: DirectoryEntry) {
  if (entry.type === 'directory') {
    if (entry.name === '..') {
      // 상위 디렉토리로 이동
      handleNavigateUp()
    } else {
      const newPath = currentPath.value.endsWith('/')
        ? currentPath.value + entry.name
        : currentPath.value + '/' + entry.name
      emit('navigate', newPath)
    }
  } else {
    emit('selectFile', entry)
  }
}

function handleNavigateUp() {
  if (currentPath.value && currentPath.value !== '/') {
    emit('navigate', getParentPath(currentPath.value))
  }
}

function handleSyncToTerminal() {
  console.log('[DirectoryBrowser] Sync button clicked')
  console.log('[DirectoryBrowser] Before: syncToTerminalRequested =', connectionStore.syncToTerminalRequested)
  connectionStore.requestSyncToTerminal()
  console.log('[DirectoryBrowser] After: syncToTerminalRequested =', connectionStore.syncToTerminalRequested)
}

function formatSize(size: number): string {
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' K'
  if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(1) + ' M'
  return (size / (1024 * 1024 * 1024)).toFixed(1) + ' G'
}
</script>

<template>
  <div class="directory-browser">
    <div class="path-bar">
      <button
        class="nav-btn"
        :disabled="!currentPath || currentPath === '/'"
        @click="handleNavigateUp"
        title="상위 폴더"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 15l-6-6-6 6"/>
        </svg>
      </button>
      <button
        class="nav-btn sync-btn"
        @click="handleSyncToTerminal"
        title="터미널 현재 경로로 이동"
        :disabled="isLoading"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m9 9a9 9 0 0 1-9-9m9 9c1.66 0 3-4.03 3-9s-1.34-9-3-9m0 18c-1.66 0-3-4.03-3-9s1.34-9 3-9"/>
        </svg>
      </button>
      <span class="current-path" :title="currentPath">
        {{ currentPath || '~' }}
      </span>
    </div>

    <div class="entries-container">
      <div v-if="isLoading" class="loading">
        <span class="spinner"></span>
        로딩 중...
      </div>

      <div v-else-if="entries.length === 0" class="empty">
        <p v-if="currentPath">빈 디렉토리</p>
        <p v-else>연결 후 표시됩니다</p>
      </div>

      <table v-else class="entries-table">
        <thead>
          <tr>
            <th class="col-name">이름</th>
            <th class="col-perm">권한</th>
            <th class="col-owner">소유자</th>
            <th class="col-size">크기</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in sortedEntries"
            :key="entry.name"
            class="entry-row"
            :class="entry.type"
            @click="handleEntryClick(entry)"
          >
            <td class="col-name">
              <span class="entry-icon" :class="entry.type">
                <svg v-if="entry.type === 'directory'" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
                </svg>
                <svg v-else-if="entry.type === 'link'" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                </svg>
                <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                </svg>
              </span>
              <span class="entry-name" :title="entry.name">{{ entry.name }}</span>
            </td>
            <td class="col-perm">
              <code>{{ entry.permissions }}</code>
            </td>
            <td class="col-owner">{{ entry.owner }}</td>
            <td class="col-size">{{ entry.type === 'directory' ? '-' : formatSize(entry.size) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.directory-browser {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-secondary);
}

.path-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--color-bg-tertiary);
  border-bottom: 1px solid var(--color-border);
  flex-shrink: 0;
}

.nav-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  background: transparent;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.nav-btn:hover:not(:disabled) {
  background: var(--color-bg-secondary);
}

.nav-btn.sync-btn:hover:not(:disabled) {
  background: var(--color-accent);
  color: white;
}

.nav-btn:disabled {
  opacity: 0.3;
}

.current-path {
  flex: 1;
  font-size: 11px;
  font-family: monospace;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entries-container {
  flex: 1;
  overflow: auto;
}

.loading,
.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  color: var(--color-text-muted);
  font-size: 12px;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.entries-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.entries-table th {
  position: sticky;
  top: 0;
  background: var(--color-bg-tertiary);
  padding: 4px 8px;
  text-align: left;
  font-weight: 500;
  color: var(--color-text-muted);
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.entries-table td {
  padding: 5px 8px;
  border-bottom: 1px solid var(--color-border);
  white-space: nowrap;
}

.entry-row {
  cursor: pointer;
  transition: background-color 0.1s;
}

.entry-row:hover {
  background: var(--color-bg-tertiary);
}

.entry-row.directory {
  font-weight: 500;
}

.col-name {
  width: 50%;
  min-width: 100px;
}

.col-name td,
.col-name th {
  display: flex;
  align-items: center;
  gap: 6px;
}

td.col-name {
  display: flex;
  align-items: center;
  gap: 6px;
}

.col-perm {
  width: 80px;
}

.col-perm code {
  font-size: 10px;
  color: var(--color-text-muted);
  background: var(--color-bg-primary);
  padding: 1px 4px;
  border-radius: 2px;
}

.col-owner {
  width: 60px;
  color: var(--color-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-size {
  width: 50px;
  text-align: right;
  color: var(--color-text-muted);
}

.entry-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  color: var(--color-text-muted);
}

.entry-icon.directory {
  color: var(--color-warning);
}

.entry-icon.link {
  color: var(--color-accent);
}

.entry-name {
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
