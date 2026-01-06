<script setup lang="ts">
import { ref, computed } from "vue";
import { storeToRefs } from "pinia";
import { useConnectionStore } from "@/stores/connectionStore";
import { useWebSocket } from "@/composables";
import TerminalTab from "./TerminalTab.vue";
import ConnectionPopup from "../connection/ConnectionPopup.vue";
import SettingsPanel from "../settings/SettingsPanel.vue";
import GlobalCommandModal from "./GlobalCommandModal.vue";

const connectionStore = useConnectionStore();
const { disconnectSession } = useWebSocket();

const showConnectionPopup = ref(false);
const showSettingsPanel = ref(false);
const showGlobalCommand = ref(false);

// 각 세션별 히스토리 열림 상태
const openHistoryIds = ref<Set<string>>(new Set());

function toggleHistory(sessionId: string) {
  if (openHistoryIds.value.has(sessionId)) {
    openHistoryIds.value.delete(sessionId);
  } else {
    openHistoryIds.value.add(sessionId);
  }
  // 반응성 트리거
  openHistoryIds.value = new Set(openHistoryIds.value);
}

function isHistoryOpen(sessionId: string): boolean {
  return openHistoryIds.value.has(sessionId);
}

// 드래그 상태
const draggedSessionId = ref<string | null>(null);
const dragOverSessionId = ref<string | null>(null);

const { sessionsArray, activeSessionId, gridCols, gridRows } =
  storeToRefs(connectionStore);

// 실제 행 수 계산 (세션 수에 따라 자동 증가)
const actualRows = computed(() => {
  const sessionCount = sessionsArray.value.length;
  if (sessionCount === 0) return gridRows.value;
  return Math.max(gridRows.value, Math.ceil(sessionCount / gridCols.value));
});

// 스크롤 필요 여부 (2행 이상일 때)
const needsScroll = computed(() => actualRows.value >= 2);

// 연결 이름 가져오기
function getConnectionName(connectionId: string): string {
  const conn = connectionStore.getConnectionById(connectionId);
  return conn?.name || "Unknown";
}

// 새 세션 열기 (ConnectionPopup에서 연결 선택 시)
function openNewSession(connectionId: string) {
  const conn = connectionStore.getConnectionById(connectionId);
  if (!conn) return;

  // 비밀번호 확인
  if (conn.authType === "password" && !conn.password) {
    const password = prompt("비밀번호를 입력하세요:");
    if (password) {
      connectionStore.setConnectionCredentials(connectionId, password);
    } else {
      return;
    }
  }

  // Private Key 확인
  if (conn.authType === "privateKey" && !conn.privateKey) {
    alert("Private Key가 없습니다. 연결을 편집하여 추가해주세요.");
    return;
  }

  // 새 세션 생성
  connectionStore.createSession(connectionId);
  showConnectionPopup.value = false;
}

// 세션 닫기
function closeSession(sessionId: string) {
  const session = connectionStore.openSessions.get(sessionId);
  if (session) {
    // WebSocket 연결 해제
    disconnectSession(session.sessionId);
    // 스토어에서 세션 제거
    connectionStore.removeSession(sessionId);
  }
}

// 탭 전환 (포커스)
function switchSession(sessionId: string) {
  connectionStore.setActiveSession(sessionId);
}

// 드래그 앤 드롭 핸들러
function handleDragStart(e: DragEvent, sessionId: string) {
  draggedSessionId.value = sessionId;
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", sessionId);
  }
}

function handleDragOver(e: DragEvent, sessionId: string) {
  e.preventDefault();
  if (e.dataTransfer) {
    e.dataTransfer.dropEffect = "move";
  }
  if (draggedSessionId.value !== sessionId) {
    dragOverSessionId.value = sessionId;
  }
}

function handleDragLeave() {
  dragOverSessionId.value = null;
}

function handleDrop(e: DragEvent, targetSessionId: string) {
  e.preventDefault();
  dragOverSessionId.value = null;

  if (!draggedSessionId.value || draggedSessionId.value === targetSessionId) {
    draggedSessionId.value = null;
    return;
  }

  // 세션 순서 변경
  connectionStore.reorderSessions(draggedSessionId.value, targetSessionId);
  draggedSessionId.value = null;
}

function handleDragEnd() {
  draggedSessionId.value = null;
  dragOverSessionId.value = null;
}

// 팝업 열기/닫기
function openConnectionPopup() {
  showConnectionPopup.value = true;
}

function closeConnectionPopup() {
  showConnectionPopup.value = false;
}

// 그리드 스타일 계산
const gridStyle = computed(() => {
  return {
    "--min-cell-width": "250px",
    "--cell-height": `calc((100% - ${(gridRows.value - 1) * 4}px) / ${
      gridRows.value
    })`,
    "--max-cols": gridCols.value,
  };
});
</script>

<template>
  <div class="terminal-panel">
    <div class="terminal-header">
      <div class="terminal-left">
        <button
          class="connection-btn"
          @click="openConnectionPopup"
          title="SSH 연결 추가"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        </button>

        <!-- 세션 탭들 -->
        <div class="connection-tabs">
          <div
            v-for="session in sessionsArray"
            :key="session.id"
            class="connection-tab"
            :class="{ active: session.id === activeSessionId }"
            @click="switchSession(session.id)"
          >
            <span class="tab-status" :class="session.status" />
            <span class="tab-name">{{
              getConnectionName(session.connectionId)
            }}</span>
            <button
              class="tab-close"
              @click.stop="closeSession(session.id)"
              title="연결 종료"
            >
              ✕
            </button>
          </div>

          <span v-if="sessionsArray.length === 0" class="no-connection">
            연결을 추가하세요
          </span>
        </div>
      </div>

      <!-- 노치 (상단 중앙) -->
      <div class="header-notch">
        <button
          class="notch-btn global-command-btn"
          @click="showGlobalCommand = true"
          title="전체 터미널에 명령어 전송"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="4 17 10 11 4 5" />
            <line x1="12" y1="19" x2="20" y2="19" />
          </svg>
          <span>Global</span>
        </button>
      </div>

      <div class="terminal-actions">
        <!-- 설정 버튼 -->
        <button
          class="action-btn settings-btn"
          @click="showSettingsPanel = true"
          title="설정"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        </button>
      </div>
    </div>

    <!-- 터미널 컨테이너 영역 -->
    <div class="terminal-containers">
      <!-- 빈 상태 -->
      <div v-if="sessionsArray.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8l4 4-4 4" />
            <line x1="12" y1="16" x2="18" y2="16" />
          </svg>
        </div>
        <p>SSH 연결을 추가하여 터미널을 시작하세요</p>
        <button @click="openConnectionPopup">+ 연결 추가</button>
      </div>

      <!-- 그리드 레이아웃 -->
      <TransitionGroup
        v-else
        name="grid"
        tag="div"
        class="terminal-grid"
        :class="{ 'has-scroll': needsScroll }"
        :style="gridStyle"
      >
        <div
          v-for="session in sessionsArray"
          :key="session.id"
          class="terminal-cell"
          :class="{
            focused: session.id === activeSessionId,
            dragging: session.id === draggedSessionId,
            'drag-over': session.id === dragOverSessionId,
          }"
          draggable="true"
          @click="switchSession(session.id)"
          @dragstart="handleDragStart($event, session.id)"
          @dragend="handleDragEnd"
        >
          <!-- 드래그 오버레이 (드래그 중일 때만 표시) -->
          <div
            v-if="draggedSessionId && draggedSessionId !== session.id"
            class="drag-overlay"
            @dragover="handleDragOver($event, session.id)"
            @dragleave="handleDragLeave"
            @drop="handleDrop($event, session.id)"
          />
          <!-- 상단 컨트롤 바 -->
          <div class="terminal-control-bar">
            <div class="control-left">
              <button
                class="control-btn close"
                @click.stop="closeSession(session.id)"
                title="닫기"
              >
                <svg width="10" height="10" viewBox="0 0 10 10">
                  <path
                    d="M1 1L9 9M9 1L1 9"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                  />
                </svg>
              </button>
              <span class="control-name">{{
                getConnectionName(session.connectionId)
              }}</span>
            </div>
            <div class="control-right">
              <div class="drag-handle" title="드래그하여 위치 변경">
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <circle cx="9" cy="6" r="2" />
                  <circle cx="15" cy="6" r="2" />
                  <circle cx="9" cy="12" r="2" />
                  <circle cx="15" cy="12" r="2" />
                  <circle cx="9" cy="18" r="2" />
                  <circle cx="15" cy="18" r="2" />
                </svg>
              </div>
            </div>
          </div>
          <div class="terminal-wrapper">
            <TerminalTab :session="session" :isActive="true" />
          </div>
          <!-- 서버 정보 바 + 히스토리 -->
          <div class="server-info-bar">
            <div class="info-content" v-if="session.serverInfo && session.status === 'connected'">
              <span class="info-item">{{ session.serverInfo.hostname }}</span>
              <span class="info-sep">|</span>
              <span class="info-item">{{ session.serverInfo.osType }}</span>
              <span class="info-sep">|</span>
              <span class="info-item">CPU {{ session.serverInfo.cpuCores }}</span>
              <span class="info-sep">|</span>
              <span class="info-item">{{ session.serverInfo.memoryTotal }}</span>
            </div>
            <div class="info-spacer"></div>
            <!-- 히스토리 버튼 -->
            <button
              class="history-btn"
              @click.stop="toggleHistory(session.id)"
              title="명령어 히스토리"
            >
              H
              <span v-if="session.commandHistory.length > 0" class="history-badge">
                {{ session.commandHistory.length }}
              </span>
            </button>
          </div>
          <!-- 히스토리 패널 -->
          <div class="history-dropdown" :class="{ open: isHistoryOpen(session.id) }">
            <div class="history-dropdown-header">
              <span>히스토리</span>
              <button @click.stop="toggleHistory(session.id)">✕</button>
            </div>
            <div class="history-dropdown-list">
              <div
                v-for="(item, idx) in session.commandHistory"
                :key="idx"
                class="history-dropdown-item"
              >
                <code>{{ item.command }}</code>
              </div>
              <div v-if="session.commandHistory.length === 0" class="history-dropdown-empty">
                히스토리 없음
              </div>
            </div>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <!-- SSH 연결 팝업 -->
    <ConnectionPopup
      v-if="showConnectionPopup"
      @close="closeConnectionPopup"
      @select="openNewSession"
    />

    <!-- 설정 패널 -->
    <SettingsPanel
      :show="showSettingsPanel"
      @close="showSettingsPanel = false"
    />

    <!-- 글로벌 커맨드 모달 -->
    <GlobalCommandModal
      :show="showGlobalCommand"
      @close="showGlobalCommand = false"
    />
  </div>
</template>

<style scoped>
.terminal-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-primary);
}

.terminal-header {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  background: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  height: var(--header-height);
}

.terminal-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  overflow: hidden;
}

.connection-btn {
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-secondary);
  transition: all 0.15s;
  flex-shrink: 0;
}

.connection-btn:hover {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-bg-primary);
}

.connection-btn svg {
  display: block;
}

.no-connection {
  color: var(--color-text-muted);
  font-size: 13px;
}

/* 연결 탭 */
.connection-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  overflow-x: auto;
}

.connection-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px 6px 12px;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  font-size: 13px;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.15s;
}

.connection-tab:hover {
  background: var(--color-bg-primary);
}

.connection-tab.active {
  background: var(--color-bg-primary);
  border-color: var(--color-accent);
}

.tab-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-text-muted);
  flex-shrink: 0;
}

.tab-status.connected {
  background: var(--color-success);
}

.tab-status.connecting {
  background: var(--color-warning);
  animation: pulse 1s infinite;
}

.tab-status.error {
  background: var(--color-error);
}

.tab-status.disconnected {
  background: var(--color-text-muted);
}

.tab-name {
  color: var(--color-text-primary);
  font-weight: 500;
}

.tab-close {
  width: 18px;
  height: 18px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 12px;
  border-radius: 4px;
  flex-shrink: 0;
}

.tab-close:hover {
  background: var(--color-error);
  color: white;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* 노치 (상단 중앙) */
.header-notch {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-top: none;
  border-radius: 0 0 12px 12px;
  height: 32px;
  z-index: 10;
}

.notch-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--color-text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.notch-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.notch-btn svg {
  flex-shrink: 0;
}

.global-command-btn:hover {
  color: var(--color-accent);
}

.terminal-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.action-btn {
  position: relative;
  width: 36px;
  height: 36px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-tertiary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  color: var(--color-text-secondary);
  transition: all 0.15s;
}

.action-btn:hover:not(:disabled) {
  background: var(--color-accent);
  border-color: var(--color-accent);
  color: var(--color-bg-primary);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn svg {
  display: block;
}

.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  font-size: 10px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
  background: var(--color-accent);
  color: var(--color-bg-primary);
  border-radius: 8px;
}

/* 터미널 컨테이너 */
.terminal-containers {
  flex: 1;
  position: relative;
  overflow: hidden;
}

/* 그리드 레이아웃 */
.terminal-grid {
  display: grid;
  grid-template-columns: repeat(var(--max-cols), 1fr);
  grid-auto-rows: var(--cell-height);
  width: 100%;
  height: 100%;
  gap: 4px;
  padding: 4px;
}

/* 스크롤 모드 (2행 이상) */
.terminal-grid.has-scroll {
  height: auto;
  max-height: 100%;
  overflow-y: auto;
}

.terminal-cell {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--color-border);
  border-radius: 4px;
  background: var(--color-bg-primary);
  transition: border-color 0.15s, box-shadow 0.15s;
  min-width: var(--min-cell-width);
  min-height: calc((100vh - var(--header-height) - 8px) / 2);
}

.terminal-cell.focused {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 1px var(--color-accent);
}

/* 터미널 래퍼 */
.terminal-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 26px; /* 서버 정보 바 높이 */
}

/* 상단 컨트롤 바 */
.terminal-control-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 4px 12px;
  background: var(--color-overlay-bg);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 10;
  transform: translateY(-100%);
  opacity: 0;
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.terminal-cell:hover .terminal-control-bar {
  transform: translateY(0);
  opacity: 1;
}

.control-left,
.control-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.control-btn {
  width: 20px;
  height: 20px;
  padding: 0;
  border: none;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  background: transparent;
  color: var(--color-overlay-text);
}

.control-btn.close:hover {
  background: #ff3b30;
  color: white;
}

.control-name {
  font-size: 11px;
  color: var(--color-overlay-text);
  font-weight: 500;
}

/* 드래그 핸들 */
.drag-handle {
  padding: 3px;
  color: var(--color-overlay-text);
  cursor: grab;
  background: var(--color-overlay-hover);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.drag-handle:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.drag-handle:active {
  cursor: grabbing;
}

/* 서버 정보 바 */
.server-info-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 3px 8px;
  background: var(--color-overlay-bg);
  backdrop-filter: blur(4px);
  font-size: 11px;
  color: var(--color-overlay-text);
  display: flex;
  align-items: center;
  z-index: 5;
}

.server-info-bar .info-content {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  overflow: hidden;
}

.server-info-bar .info-spacer {
  flex: 1;
}

.server-info-bar .info-item {
  color: var(--color-overlay-text);
}

.server-info-bar .info-sep {
  color: var(--color-text-muted);
  font-size: 10px;
}

/* 빈 상태 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 16px;
  color: var(--color-text-muted);
}

.empty-icon {
  opacity: 0.5;
}

.empty-state p {
  font-size: 14px;
}

.empty-state button {
  padding: 8px 16px;
  font-size: 13px;
  background: var(--color-accent);
  color: var(--color-bg-primary);
  border-radius: 6px;
}

.empty-state button:hover {
  opacity: 0.9;
}

/* 히스토리 버튼 (서버 정보 바 내) */
.history-btn {
  width: 18px;
  height: 18px;
  border-radius: 3px;
  background: transparent;
  border: 1px solid var(--color-text-muted);
  color: var(--color-text-muted);
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  position: relative;
  flex-shrink: 0;
}

.history-btn:hover {
  background: var(--color-accent);
  color: var(--color-bg-primary);
  border-color: var(--color-accent);
}

.history-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  min-width: 12px;
  height: 12px;
  padding: 0 3px;
  font-size: 8px;
  font-weight: 600;
  line-height: 12px;
  text-align: center;
  background: var(--color-error);
  color: white;
  border-radius: 6px;
}

/* 히스토리 드롭다운 (투명 배경) */
.history-dropdown {
  position: absolute;
  bottom: 26px;
  right: 8px;
  width: 260px;
  max-height: 180px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  overflow: hidden;
  opacity: 0;
  transform: translateY(10px);
  pointer-events: none;
  transition: all 0.2s ease;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  z-index: 30;
}

[data-theme="light"] .history-dropdown {
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.history-dropdown.open {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.history-dropdown-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  font-size: 11px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

[data-theme="light"] .history-dropdown-header {
  border-bottom-color: rgba(0, 0, 0, 0.1);
  color: rgba(0, 0, 0, 0.8);
}

.history-dropdown-header button {
  width: 18px;
  height: 18px;
  padding: 0;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  border-radius: 4px;
  font-size: 11px;
}

[data-theme="light"] .history-dropdown-header button {
  color: rgba(0, 0, 0, 0.5);
}

.history-dropdown-header button:hover {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.9);
}

[data-theme="light"] .history-dropdown-header button:hover {
  background: rgba(0, 0, 0, 0.1);
  color: rgba(0, 0, 0, 0.8);
}

.history-dropdown-list {
  max-height: 130px;
  overflow-y: auto;
  padding: 4px;
}

.history-dropdown-item {
  padding: 5px 8px;
  border-radius: 4px;
  transition: background 0.15s;
}

.history-dropdown-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

[data-theme="light"] .history-dropdown-item:hover {
  background: rgba(0, 0, 0, 0.1);
}

.history-dropdown-item code {
  font-family: "Cascadia Code", "Fira Code", monospace;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.9);
  word-break: break-all;
}

[data-theme="light"] .history-dropdown-item code {
  color: rgba(0, 0, 0, 0.8);
}

.history-dropdown-empty {
  padding: 12px;
  text-align: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: 11px;
}

[data-theme="light"] .history-dropdown-empty {
  color: rgba(0, 0, 0, 0.5);
}

/* Grid 애니메이션 (TransitionGroup) */
.grid-move {
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.grid-enter-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
}

.grid-leave-active {
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  position: absolute;
}

.grid-enter-from {
  opacity: 0;
  transform: scale(0.9);
}

.grid-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

/* 드래그 오버레이 */
.drag-overlay {
  position: absolute;
  inset: 0;
  z-index: 50;
  background: transparent;
  cursor: grab;
}

/* 드래그 중인 셀 스타일 개선 */
.terminal-cell.dragging {
  opacity: 0.6;
  transform: scale(0.98);
  border-color: var(--color-accent);
  border-style: dashed;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
  z-index: 100;
}

/* 드롭 대상 셀 스타일 (스위칭 표시) */
.terminal-cell.drag-over {
  border-color: var(--color-success);
  border-width: 2px;
  background: rgba(74, 222, 128, 0.15);
  box-shadow: inset 0 0 20px rgba(74, 222, 128, 0.3), 0 0 0 4px rgba(74, 222, 128, 0.2);
}

.terminal-cell.drag-over::before {
  content: '⇄ 위치 교환';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 8px 16px;
  background: var(--color-success);
  color: white;
  font-size: 12px;
  font-weight: 600;
  border-radius: 6px;
  z-index: 20;
  pointer-events: none;
  animation: pulse-badge 1s infinite;
}

@keyframes pulse-badge {
  0%, 100% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 1;
  }
  50% {
    transform: translate(-50%, -50%) scale(1.05);
    opacity: 0.9;
  }
}
</style>
