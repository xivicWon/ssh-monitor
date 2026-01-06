<script setup lang="ts">
import TerminalPanel from '../terminal/TerminalPanel.vue'
</script>

<template>
  <div class="main-view">
    <TerminalPanel class="terminal-panel" />
  </div>
</template>

<style scoped>
.main-view {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.terminal-panel {
  flex: 1;
  width: 100%;
}
</style>
