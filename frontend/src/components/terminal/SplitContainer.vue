<script setup lang="ts">
import { ref, computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useConnectionStore } from '@/stores/connectionStore'
import type { SplitPane } from '@/types'
import TerminalTab from './TerminalTab.vue'

const props = defineProps<{
  pane: SplitPane
}>()

const connectionStore = useConnectionStore()
const { openSessions, focusedPaneId } = storeToRefs(connectionStore)

const isDragging = ref(false)
const dragStartPos = ref(0)
const dragStartSize = ref(0)

// 현재 pane의 세션 가져오기
const session = computed(() => {
  if (props.pane.type === 'terminal' && props.pane.sessionId) {
    return openSessions.value.get(props.pane.sessionId) || null
  }
  return null
})

// 포커스 여부
const isFocused = computed(() => focusedPaneId.value === props.pane.id)

// 터미널 클릭 시 포커스
function handlePaneClick() {
  if (props.pane.type === 'terminal') {
    connectionStore.setFocusedPane(props.pane.id)
    connectionStore.setActiveSession(props.pane.sessionId || null)
  }
}

// 리사이즈 시작
function startResize(e: MouseEvent, index: number) {
  if (!props.pane.children || index >= props.pane.children.length) return

  isDragging.value = true
  const isHorizontal = props.pane.direction === 'horizontal'
  dragStartPos.value = isHorizontal ? e.clientX : e.clientY
  dragStartSize.value = props.pane.children[index].size || 50

  const handleMouseMove = (moveEvent: MouseEvent) => {
    if (!isDragging.value || !props.pane.children) return

    const container = (e.target as HTMLElement).closest('.split-container') as HTMLElement
    if (!container) return

    const isHorizontal = props.pane.direction === 'horizontal'
    const containerSize = isHorizontal ? container.offsetWidth : container.offsetHeight
    const delta = isHorizontal
      ? moveEvent.clientX - dragStartPos.value
      : moveEvent.clientY - dragStartPos.value

    const deltaPercent = (delta / containerSize) * 100
    const newSize = Math.max(10, Math.min(90, dragStartSize.value + deltaPercent))

    connectionStore.updatePaneSize(props.pane.children[index].id, newSize)
    // 형제 pane 크기도 조정
    if (props.pane.children[index + 1]) {
      connectionStore.updatePaneSize(props.pane.children[index + 1].id, 100 - newSize)
    }
  }

  const handleMouseUp = () => {
    isDragging.value = false
    document.removeEventListener('mousemove', handleMouseMove)
    document.removeEventListener('mouseup', handleMouseUp)
  }

  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
}

// Flex basis 계산
function getFlexBasis(child: SplitPane): string {
  return `${child.size || 50}%`
}
</script>

<template>
  <div
    class="split-container"
    :class="{
      'is-terminal': pane.type === 'terminal',
      'is-split': pane.type === 'split',
      'is-horizontal': pane.direction === 'horizontal',
      'is-vertical': pane.direction === 'vertical',
      'is-focused': isFocused && pane.type === 'terminal',
      'is-dragging': isDragging
    }"
    @click.stop="handlePaneClick"
  >
    <!-- 터미널 타입 -->
    <template v-if="pane.type === 'terminal'">
      <div class="terminal-pane" :class="{ empty: !session }">
        <TerminalTab
          v-if="session"
          :session="session"
          :isActive="true"
        />
        <div v-else class="empty-pane">
          <span>빈 창</span>
        </div>
      </div>
    </template>

    <!-- 분할 타입 -->
    <template v-else-if="pane.type === 'split' && pane.children">
      <template v-for="(child, index) in pane.children" :key="child.id">
        <div
          class="split-child"
          :style="{ flexBasis: getFlexBasis(child) }"
        >
          <SplitContainer :pane="child" />
        </div>
        <!-- 리사이즈 핸들 (마지막 자식 제외) -->
        <div
          v-if="index < pane.children.length - 1"
          class="resize-handle"
          :class="pane.direction"
          @mousedown.stop="startResize($event, index)"
        />
      </template>
    </template>
  </div>
</template>

<style scoped>
.split-container {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
}

.split-container.is-terminal {
  flex-direction: column;
}

.split-container.is-horizontal {
  flex-direction: row;
}

.split-container.is-vertical {
  flex-direction: column;
}

.split-container.is-dragging {
  user-select: none;
}

.terminal-pane {
  width: 100%;
  height: 100%;
  position: relative;
  border: 2px solid transparent;
  border-radius: 4px;
  transition: border-color 0.15s;
}

.split-container.is-focused .terminal-pane {
  border-color: var(--color-accent);
}

.empty-pane {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
  background: var(--color-bg-tertiary);
  border-radius: 4px;
}

.split-child {
  flex-shrink: 0;
  flex-grow: 0;
  overflow: hidden;
  min-width: 100px;
  min-height: 100px;
}

.resize-handle {
  flex-shrink: 0;
  background: var(--color-border);
  transition: background 0.15s;
}

.resize-handle.horizontal {
  width: 4px;
  cursor: col-resize;
}

.resize-handle.vertical {
  height: 4px;
  cursor: row-resize;
}

.resize-handle:hover {
  background: var(--color-accent);
}
</style>
