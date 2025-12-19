<script setup lang="ts">
import LeftSidebar from './LeftSidebar.vue'
import TerminalPanel from '../terminal/TerminalPanel.vue'
import RightPanel from './RightPanel.vue'
</script>

<template>
  <div class="main-view">
    <LeftSidebar class="left-sidebar" />
    <TerminalPanel class="terminal-panel" />
    <RightPanel class="right-panel" />
  </div>
</template>

<style scoped>
.main-view {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.left-sidebar {
  flex: 2;
  min-width: 200px;
  max-width: 320px;
  border-right: 1px solid var(--color-border);
}

.terminal-panel {
  flex: 7;
  min-width: 400px;
}

.right-panel {
  flex: 1;
  min-width: 160px;
  max-width: 240px;
  border-left: 1px solid var(--color-border);
}
</style>
