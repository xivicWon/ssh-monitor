<script setup lang="ts">
import { ref, nextTick, computed, watch } from "vue";
import { storeToRefs } from "pinia";
import { useConnectionStore } from "@/stores/connectionStore";
import { useWebSocket } from "@/composables";

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const connectionStore = useConnectionStore();
const { sendInput } = useWebSocket();
const { sessionsArray } = storeToRefs(connectionStore);

const command = ref("");
const inputRef = ref<HTMLInputElement | null>(null);
const showTargetList = ref(false);

// 선택된 세션 ID Set
const selectedSessionIds = ref<Set<string>>(new Set());

// 연결된 세션
const connectedSessions = computed(() =>
  sessionsArray.value.filter((s) => s.status === "connected")
);

// 대상 세션 (선택된 것만)
const targetSessions = computed(() =>
  connectedSessions.value.filter((s) => selectedSessionIds.value.has(s.id))
);

// 모달이 열릴 때 초기화
watch(() => props.show, (show) => {
  if (show) {
    // 모든 연결된 세션을 기본 선택
    selectedSessionIds.value = new Set(connectedSessions.value.map(s => s.id));
  }
});

// 연결 이름 가져오기
function getConnectionName(connectionId: string): string {
  const conn = connectionStore.getConnectionById(connectionId);
  return conn?.name || "Unknown";
}

// 세션 선택 토글
function toggleSession(sessionId: string) {
  if (selectedSessionIds.value.has(sessionId)) {
    selectedSessionIds.value.delete(sessionId);
  } else {
    selectedSessionIds.value.add(sessionId);
  }
  selectedSessionIds.value = new Set(selectedSessionIds.value);
}

// 전체 선택/해제
function toggleAll() {
  if (selectedSessionIds.value.size === connectedSessions.value.length) {
    selectedSessionIds.value = new Set();
  } else {
    selectedSessionIds.value = new Set(connectedSessions.value.map(s => s.id));
  }
}

// 모달이 열릴 때 입력에 포커스
function onEnter() {
  nextTick(() => {
    inputRef.value?.focus();
  });
}

// 대상 세션에 명령어 전송 (기존 입력 제거 후)
function sendGlobalCommand() {
  if (!command.value.trim() || targetSessions.value.length === 0) return;

  const cmdToSend = command.value + "\n";
  // Ctrl+U (라인 클리어) + 명령어
  const clearAndSend = "\x15" + cmdToSend;

  targetSessions.value.forEach((session) => {
    sendInput({ sessionId: session.sessionId, data: clearAndSend });
  });

  // 입력만 클리어하고 모달은 유지 (여러 번 입력 가능)
  command.value = "";
}

// ESC 키로 닫기
function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape") {
    emit("close");
  } else if (e.key === "Enter") {
    sendGlobalCommand();
  }
}

// 오버레이 클릭 시 닫기
function handleOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains("global-command-overlay")) {
    emit("close");
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal" @after-enter="onEnter">
      <div
        v-if="props.show"
        class="global-command-overlay"
        @click="handleOverlayClick"
        @keydown="handleKeydown"
      >
        <div class="global-command-modal">
          <!-- 경고 아이콘과 메시지 -->
          <div class="warning-badge">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
              />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>선택한 터미널에 전송됩니다</span>
            <span class="session-count"
              >({{ targetSessions.length }}/{{ connectedSessions.length }}개)</span
            >
          </div>

          <!-- 대상 서버 리스트 (펼침/접힘) -->
          <div class="target-list-section">
            <button class="target-list-toggle" @click="showTargetList = !showTargetList">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                :class="{ rotated: showTargetList }"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
              <span>대상 서버</span>
              <span class="target-count">{{ targetSessions.length }}개 선택</span>
            </button>

            <Transition name="collapse">
              <div v-if="showTargetList" class="target-list">
                <div class="target-list-header">
                  <button class="select-all-btn" @click="toggleAll">
                    {{ selectedSessionIds.size === connectedSessions.length ? '전체 해제' : '전체 선택' }}
                  </button>
                </div>
                <div class="target-list-items">
                  <label
                    v-for="session in connectedSessions"
                    :key="session.id"
                    class="target-item"
                    :class="{ selected: selectedSessionIds.has(session.id) }"
                  >
                    <input
                      type="checkbox"
                      :checked="selectedSessionIds.has(session.id)"
                      @change="toggleSession(session.id)"
                    />
                    <span class="target-status" />
                    <span class="target-name">{{ getConnectionName(session.connectionId) }}</span>
                  </label>
                  <div v-if="connectedSessions.length === 0" class="target-empty">
                    연결된 서버가 없습니다
                  </div>
                </div>
              </div>
            </Transition>
          </div>

          <!-- 입력 필드 -->
          <div class="input-wrapper">
            <span class="prompt">$</span>
            <input
              ref="inputRef"
              v-model="command"
              type="text"
              placeholder="명령어를 입력하세요..."
              class="command-input"
              autocomplete="off"
              spellcheck="false"
            />
            <button
              class="send-btn"
              @click="sendGlobalCommand"
              :disabled="!command.trim() || targetSessions.length === 0"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>

          <!-- 단축키 힌트 -->
          <div class="hint">
            <span><kbd>Enter</kbd> 전송</span>
            <span><kbd>Esc</kbd> 닫기</span>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.global-command-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 2000;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 8vh;
}

[data-theme="light"] .global-command-overlay {
  background: rgba(255, 255, 255, 0.4);
}

.global-command-modal {
  width: 100%;
  max-width: 540px;
  padding: 20px 24px;
  background: rgba(30, 30, 46, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.4);
}

[data-theme="light"] .global-command-modal {
  background: rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(0, 0, 0, 0.1);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.15);
}

.warning-badge {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 16px;
  padding: 8px 16px;
  background: rgba(243, 139, 168, 0.15);
  border: 1px solid rgba(243, 139, 168, 0.3);
  border-radius: 8px;
  color: #f38ba8;
  font-size: 13px;
  font-weight: 500;
}

[data-theme="light"] .warning-badge {
  background: rgba(210, 15, 57, 0.1);
  border-color: rgba(210, 15, 57, 0.2);
  color: #d20f39;
}

.warning-badge svg {
  flex-shrink: 0;
}

.session-count {
  color: var(--color-text-muted);
  font-weight: 400;
}

/* 대상 서버 리스트 섹션 */
.target-list-section {
  margin-bottom: 16px;
}

.target-list-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: var(--color-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.target-list-toggle:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--color-text-primary);
}

[data-theme="light"] .target-list-toggle {
  background: rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.1);
}

[data-theme="light"] .target-list-toggle:hover {
  background: rgba(0, 0, 0, 0.06);
}

.target-list-toggle svg {
  transition: transform 0.2s;
  flex-shrink: 0;
}

.target-list-toggle svg.rotated {
  transform: rotate(90deg);
}

.target-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--color-accent);
  font-weight: 500;
}

.target-list {
  margin-top: 8px;
  padding: 8px;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

[data-theme="light"] .target-list {
  background: rgba(0, 0, 0, 0.03);
  border-color: rgba(0, 0, 0, 0.05);
}

.target-list-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 6px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

[data-theme="light"] .target-list-header {
  border-bottom-color: rgba(0, 0, 0, 0.05);
}

.select-all-btn {
  padding: 4px 10px;
  background: transparent;
  border: 1px solid var(--color-text-muted);
  border-radius: 4px;
  color: var(--color-text-muted);
  font-size: 11px;
  cursor: pointer;
  transition: all 0.15s;
}

.select-all-btn:hover {
  border-color: var(--color-accent);
  color: var(--color-accent);
}

.target-list-items {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 150px;
  overflow-y: auto;
}

.target-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.target-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.target-item.selected {
  background: rgba(137, 180, 250, 0.1);
  border-color: rgba(137, 180, 250, 0.3);
}

[data-theme="light"] .target-item {
  background: rgba(0, 0, 0, 0.02);
}

[data-theme="light"] .target-item:hover {
  background: rgba(0, 0, 0, 0.05);
}

[data-theme="light"] .target-item.selected {
  background: rgba(30, 102, 245, 0.1);
  border-color: rgba(30, 102, 245, 0.3);
}

.target-item input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--color-accent);
  cursor: pointer;
}

.target-status {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--color-success);
  flex-shrink: 0;
}

.target-name {
  font-size: 13px;
  color: var(--color-text-primary);
}

.target-empty {
  padding: 16px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 12px;
}

/* Collapse transition */
.collapse-enter-active,
.collapse-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}

.collapse-enter-from,
.collapse-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}

.collapse-enter-to,
.collapse-leave-from {
  opacity: 1;
  max-height: 250px;
}

.input-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.3);
  border: 2px solid var(--color-border);
  border-radius: 12px;
  transition: border-color 0.15s;
}

.input-wrapper:focus-within {
  border-color: var(--color-accent);
}

[data-theme="light"] .input-wrapper {
  background: rgba(0, 0, 0, 0.05);
}

.prompt {
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 18px;
  font-weight: 600;
}

.command-input {
  flex: 1;
  background: transparent;
  border: none;
  color: var(--color-text-primary);
  font-family: var(--font-mono);
  font-size: 16px;
  outline: none;
  padding: 0;
}

.command-input::placeholder {
  color: var(--color-text-muted);
}

.send-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-accent);
  border: none;
  border-radius: 8px;
  color: var(--color-bg-primary);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(137, 180, 250, 0.4);
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.hint kbd {
  display: inline-block;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 4px;
  font-family: inherit;
  font-size: 11px;
  margin-right: 4px;
}

[data-theme="light"] .hint kbd {
  background: rgba(0, 0, 0, 0.05);
  border-color: rgba(0, 0, 0, 0.1);
}

/* Transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-active .global-command-modal,
.modal-leave-active .global-command-modal {
  transition: transform 0.2s ease, opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .global-command-modal,
.modal-leave-to .global-command-modal {
  opacity: 0;
  transform: translateY(-20px) scale(0.95);
}
</style>
