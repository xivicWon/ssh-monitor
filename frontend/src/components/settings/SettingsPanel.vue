<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useConnectionStore } from "@/stores/connectionStore";
import { useThemeStore, FONT_OPTIONS, FONT_SIZE_OPTIONS, type FontId } from "@/stores/themeStore";

const props = defineProps<{
  show: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

const connectionStore = useConnectionStore();
const themeStore = useThemeStore();

const { theme, fontId, fontSize } = storeToRefs(themeStore);
const { gridCols, gridRows } = storeToRefs(connectionStore);

// 폰트 사이즈 변경
function changeFontSize(delta: number) {
  const currentIndex = FONT_SIZE_OPTIONS.indexOf(fontSize.value);
  const newIndex = Math.max(0, Math.min(FONT_SIZE_OPTIONS.length - 1, currentIndex + delta));
  themeStore.setFontSize(FONT_SIZE_OPTIONS[newIndex]);
}

// 그리드 크기 변경
function updateGridCols(e: Event) {
  const value = parseInt((e.target as HTMLInputElement).value);
  if (!isNaN(value) && value >= 1 && value <= 4) {
    connectionStore.setGridSize(value, gridRows.value);
  }
}

function updateGridRows(e: Event) {
  const value = parseInt((e.target as HTMLInputElement).value);
  if (!isNaN(value) && value >= 1 && value <= 4) {
    connectionStore.setGridSize(gridCols.value, value);
  }
}

// 폰트 선택
function selectFont(id: FontId) {
  themeStore.setFont(id);
}

// 패널 외부 클릭 시 닫기
function handleOverlayClick(e: MouseEvent) {
  if ((e.target as HTMLElement).classList.contains("settings-overlay")) {
    emit("close");
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="settings">
      <div v-if="props.show" class="settings-overlay" @click="handleOverlayClick">
        <div class="settings-panel">
          <div class="settings-header">
            <h2>설정</h2>
            <button class="close-btn" @click="emit('close')" title="닫기">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div class="settings-content">
            <!-- 테마 설정 -->
            <section class="settings-section">
              <h3>테마</h3>
              <div class="theme-options">
                <button
                  class="theme-option"
                  :class="{ active: theme === 'dark' }"
                  @click="themeStore.setTheme('dark')"
                >
                  <div class="theme-preview dark">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                    </svg>
                  </div>
                  <span>다크</span>
                </button>
                <button
                  class="theme-option"
                  :class="{ active: theme === 'light' }"
                  @click="themeStore.setTheme('light')"
                >
                  <div class="theme-preview light">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="5" />
                      <line x1="12" y1="1" x2="12" y2="3" />
                      <line x1="12" y1="21" x2="12" y2="23" />
                      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                      <line x1="1" y1="12" x2="3" y2="12" />
                      <line x1="21" y1="12" x2="23" y2="12" />
                      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                    </svg>
                  </div>
                  <span>라이트</span>
                </button>
              </div>
            </section>

            <!-- 그리드 레이아웃 설정 -->
            <section class="settings-section">
              <h3>그리드 레이아웃</h3>
              <p class="section-desc">터미널 분할 화면의 레이아웃을 설정합니다.</p>
              <div class="grid-settings">
                <label class="grid-field">
                  <span>가로 분할</span>
                  <div class="input-group">
                    <button
                      class="stepper-btn"
                      :disabled="gridCols <= 1"
                      @click="connectionStore.setGridSize(gridCols - 1, gridRows)"
                    >−</button>
                    <input
                      type="number"
                      :value="gridCols"
                      min="1"
                      max="4"
                      @change="updateGridCols"
                      class="grid-input"
                    />
                    <button
                      class="stepper-btn"
                      :disabled="gridCols >= 4"
                      @click="connectionStore.setGridSize(gridCols + 1, gridRows)"
                    >+</button>
                  </div>
                </label>
                <label class="grid-field">
                  <span>세로 분할</span>
                  <div class="input-group">
                    <button
                      class="stepper-btn"
                      :disabled="gridRows <= 1"
                      @click="connectionStore.setGridSize(gridCols, gridRows - 1)"
                    >−</button>
                    <input
                      type="number"
                      :value="gridRows"
                      min="1"
                      max="4"
                      @change="updateGridRows"
                      class="grid-input"
                    />
                    <button
                      class="stepper-btn"
                      :disabled="gridRows >= 4"
                      @click="connectionStore.setGridSize(gridCols, gridRows + 1)"
                    >+</button>
                  </div>
                </label>
              </div>
              <div class="grid-preview">
                <div
                  class="grid-preview-inner"
                  :style="{
                    gridTemplateColumns: `repeat(${gridCols}, 1fr)`,
                    gridTemplateRows: `repeat(${gridRows}, 1fr)`
                  }"
                >
                  <div
                    v-for="i in gridCols * gridRows"
                    :key="i"
                    class="grid-preview-cell"
                  />
                </div>
              </div>
            </section>

            <!-- 폰트 크기 설정 -->
            <section class="settings-section">
              <h3>폰트 크기</h3>
              <p class="section-desc">터미널 폰트 크기를 조절합니다.</p>
              <div class="font-size-control">
                <button
                  class="stepper-btn large"
                  :disabled="fontSize <= FONT_SIZE_OPTIONS[0]"
                  @click="changeFontSize(-1)"
                >−</button>
                <span class="font-size-display">{{ fontSize }}px</span>
                <button
                  class="stepper-btn large"
                  :disabled="fontSize >= FONT_SIZE_OPTIONS[FONT_SIZE_OPTIONS.length - 1]"
                  @click="changeFontSize(1)"
                >+</button>
              </div>
              <div class="font-size-preview" :style="{ fontSize: fontSize + 'px' }">
                AaBbCc 123 $&gt;_
              </div>
            </section>

            <!-- 폰트 설정 -->
            <section class="settings-section">
              <h3>터미널 폰트</h3>
              <p class="section-desc">터미널에 사용할 폰트를 선택합니다.</p>
              <div class="font-list">
                <button
                  v-for="font in FONT_OPTIONS"
                  :key="font.id"
                  class="font-item"
                  :class="{ active: font.id === fontId }"
                  @click="selectFont(font.id)"
                >
                  <div class="font-info">
                    <span class="font-name" :style="{ fontFamily: font.value }">{{ font.name }}</span>
                    <span class="font-desc">{{ font.desc }}</span>
                  </div>
                  <span class="font-sample" :style="{ fontFamily: font.value }">AaBb 012</span>
                  <svg
                    v-if="font.id === fontId"
                    class="check-icon"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="3"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.settings-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 1000;
  display: flex;
  justify-content: flex-end;
}

.settings-panel {
  width: 360px;
  max-width: 100%;
  height: 100%;
  background: var(--color-bg-secondary);
  border-left: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.3);
}

.settings-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.settings-header h2 {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}

.close-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.close-btn:hover {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.settings-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.settings-section {
  margin-bottom: 28px;
}

.settings-section:last-child {
  margin-bottom: 0;
}

.settings-section h3 {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0 0 8px 0;
}

.section-desc {
  font-size: 12px;
  color: var(--color-text-muted);
  margin: 0 0 12px 0;
}

/* 테마 옵션 */
.theme-options {
  display: flex;
  gap: 12px;
}

.theme-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: var(--color-bg-primary);
  border: 2px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.theme-option:hover {
  border-color: var(--color-text-muted);
}

.theme-option.active {
  border-color: var(--color-accent);
  background: var(--color-bg-tertiary);
}

.theme-preview {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-preview.dark {
  background: #1e1e2e;
  color: #cdd6f4;
}

.theme-preview.light {
  background: #eff1f5;
  color: #4c4f69;
}

.theme-option span {
  font-size: 13px;
  color: var(--color-text-primary);
  font-weight: 500;
}

/* 그리드 설정 */
.grid-settings {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.grid-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.grid-field span {
  font-size: 12px;
  color: var(--color-text-secondary);
}

.input-group {
  display: flex;
  align-items: center;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 6px;
  overflow: hidden;
}

.stepper-btn {
  width: 32px;
  height: 32px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--color-text-secondary);
  font-size: 16px;
  cursor: pointer;
  transition: all 0.15s;
}

.stepper-btn:hover:not(:disabled) {
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
}

.stepper-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.stepper-btn.large {
  width: 40px;
  height: 40px;
  font-size: 20px;
  border-radius: 8px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
}

.stepper-btn.large:hover:not(:disabled) {
  border-color: var(--color-accent);
}

/* 폰트 크기 컨트롤 */
.font-size-control {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 12px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  margin-bottom: 12px;
}

.font-size-display {
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text-primary);
  min-width: 60px;
  text-align: center;
}

.font-size-preview {
  padding: 12px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  font-family: var(--font-mono);
  color: var(--color-text-secondary);
  text-align: center;
}

.grid-input {
  width: 40px;
  height: 32px;
  padding: 0;
  text-align: center;
  background: transparent;
  border: none;
  border-left: 1px solid var(--color-border);
  border-right: 1px solid var(--color-border);
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 500;
}

.grid-input:focus {
  outline: none;
}

.grid-input::-webkit-inner-spin-button,
.grid-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* 그리드 미리보기 */
.grid-preview {
  padding: 12px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
}

.grid-preview-inner {
  display: grid;
  gap: 4px;
  aspect-ratio: 16 / 9;
}

.grid-preview-cell {
  background: var(--color-bg-tertiary);
  border-radius: 3px;
  border: 1px solid var(--color-border);
}

/* 폰트 목록 */
.font-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.font-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  text-align: left;
}

.font-item:hover {
  border-color: var(--color-text-muted);
  background: var(--color-bg-tertiary);
}

.font-item.active {
  border-color: var(--color-accent);
  background: var(--color-bg-tertiary);
}

.font-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.font-name {
  font-size: 14px;
  color: var(--color-text-primary);
  font-weight: 500;
}

.font-desc {
  font-size: 11px;
  color: var(--color-text-muted);
}

.font-sample {
  font-size: 14px;
  color: var(--color-text-secondary);
  flex-shrink: 0;
}

.check-icon {
  color: var(--color-accent);
  flex-shrink: 0;
}

/* 트랜지션 */
.settings-enter-active,
.settings-leave-active {
  transition: opacity 0.2s ease;
}

.settings-enter-active .settings-panel,
.settings-leave-active .settings-panel {
  transition: transform 0.25s ease;
}

.settings-enter-from,
.settings-leave-to {
  opacity: 0;
}

.settings-enter-from .settings-panel,
.settings-leave-to .settings-panel {
  transform: translateX(100%);
}
</style>
