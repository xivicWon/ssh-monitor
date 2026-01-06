<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useConnectionStore } from '@/stores/connectionStore'
import type { ConnectionFormData, AuthType } from '@/types'

const props = defineProps<{
  editingId: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const connectionStore = useConnectionStore()

const isExpanded = ref(true)

const formData = ref<ConnectionFormData>({
  name: '',
  host: '',
  port: 22,
  username: '',
  authType: 'password',
  password: '',
  privateKey: ''
})

const isEditing = computed(() => props.editingId !== null)

function toggleExpand() {
  isExpanded.value = !isExpanded.value
}

function resetForm() {
  formData.value = {
    name: '',
    host: '',
    port: 22,
    username: '',
    authType: 'password',
    password: '',
    privateKey: ''
  }
}

function loadEditingData() {
  if (props.editingId) {
    const connection = connectionStore.connections.find(c => c.id === props.editingId)
    if (connection) {
      formData.value = {
        name: connection.name,
        host: connection.host,
        port: connection.port,
        username: connection.username,
        authType: connection.authType,
        password: connection.password || '',
        privateKey: connection.privateKey || ''
      }
    }
  } else {
    resetForm()
  }
}

watch(() => props.editingId, () => {
  loadEditingData()
  isExpanded.value = true
}, { immediate: false })

onMounted(() => {
  loadEditingData()
})

function handleSubmit() {
  if (!formData.value.name || !formData.value.host || !formData.value.username) {
    alert('필수 항목을 입력해주세요.')
    return
  }

  if (formData.value.authType === 'password' && !formData.value.password) {
    alert('비밀번호를 입력해주세요.')
    return
  }

  if (formData.value.authType === 'privateKey' && !formData.value.privateKey) {
    alert('Private Key를 입력해주세요.')
    return
  }

  if (isEditing.value && props.editingId) {
    connectionStore.updateConnection(props.editingId, formData.value)
  } else {
    connectionStore.addConnection(formData.value)
  }

  emit('close')
}

function handleCancel() {
  emit('close')
}

function handleAuthTypeChange(type: AuthType) {
  formData.value.authType = type
  if (type === 'password') {
    formData.value.privateKey = ''
  } else {
    formData.value.password = ''
  }
}
</script>

<template>
  <div class="form-panel">
    <!-- 접기/펼치기 헤더 -->
    <div class="form-header" @click="toggleExpand">
      <div class="header-left">
        <span class="fold-icon" :class="{ expanded: isExpanded }">▶</span>
        <h3>{{ isEditing ? '연결 편집' : '새 연결 추가' }}</h3>
      </div>
      <button class="close-btn" @click.stop="handleCancel" title="닫기">✕</button>
    </div>

    <!-- 접을 수 있는 폼 내용 -->
    <Transition name="fold">
      <div v-show="isExpanded" class="form-content">
        <form @submit.prevent="handleSubmit">
          <div class="form-group">
            <label for="name">연결 이름 *</label>
            <input
              id="name"
              v-model="formData.name"
              type="text"
              placeholder="My Server"
              required
            />
          </div>

          <div class="form-row">
            <div class="form-group flex-grow">
              <label for="host">호스트 *</label>
              <input
                id="host"
                v-model="formData.host"
                type="text"
                placeholder="192.168.1.100"
                required
              />
            </div>
            <div class="form-group port-group">
              <label for="port">포트</label>
              <input
                id="port"
                v-model.number="formData.port"
                type="number"
                min="1"
                max="65535"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="username">사용자명 *</label>
            <input
              id="username"
              v-model="formData.username"
              type="text"
              placeholder="root"
              required
            />
          </div>

          <div class="form-group">
            <label>인증 방식</label>
            <div class="auth-toggle">
              <button
                type="button"
                :class="{ active: formData.authType === 'password' }"
                @click="handleAuthTypeChange('password')"
              >
                비밀번호
              </button>
              <button
                type="button"
                :class="{ active: formData.authType === 'privateKey' }"
                @click="handleAuthTypeChange('privateKey')"
              >
                Private Key
              </button>
            </div>
          </div>

          <div v-if="formData.authType === 'password'" class="form-group">
            <label for="password">비밀번호 *</label>
            <input
              id="password"
              v-model="formData.password"
              type="password"
              placeholder="비밀번호 입력"
            />
          </div>

          <div v-if="formData.authType === 'privateKey'" class="form-group">
            <label for="privateKey">Private Key *</label>
            <textarea
              id="privateKey"
              v-model="formData.privateKey"
              placeholder="-----BEGIN RSA PRIVATE KEY-----&#10;...&#10;-----END RSA PRIVATE KEY-----"
              rows="4"
            />
          </div>

          <div class="form-actions">
            <button type="button" class="cancel-btn" @click="handleCancel">
              취소
            </button>
            <button type="submit" class="submit-btn">
              {{ isEditing ? '저장' : '추가' }}
            </button>
          </div>
        </form>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.form-panel {
  background: var(--color-bg-tertiary);
  border-bottom: 1px solid var(--color-border);
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}

.form-header:hover {
  background: rgba(255, 255, 255, 0.05);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fold-icon {
  font-size: 10px;
  color: var(--color-text-muted);
  transition: transform 0.2s;
}

.fold-icon.expanded {
  transform: rotate(90deg);
}

.form-header h3 {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
}

.close-btn {
  width: 22px;
  height: 22px;
  padding: 0;
  background: transparent;
  font-size: 12px;
  color: var(--color-text-muted);
  border-radius: 4px;
}

.close-btn:hover {
  background: var(--color-bg-secondary);
  color: var(--color-text-primary);
}

.form-content {
  overflow: hidden;
}

form {
  padding: 12px;
}

.form-group {
  margin-bottom: 12px;
}

.form-group label {
  display: block;
  margin-bottom: 4px;
  font-size: 11px;
  color: var(--color-text-muted);
}

.form-group input,
.form-group textarea {
  font-size: 13px;
  padding: 6px 10px;
}

.form-row {
  display: flex;
  gap: 8px;
}

.flex-grow {
  flex: 1;
}

.port-group {
  width: 70px;
}

.auth-toggle {
  display: flex;
  gap: 6px;
}

.auth-toggle button {
  flex: 1;
  padding: 6px;
  font-size: 12px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
}

.auth-toggle button.active {
  background: var(--color-accent);
  color: var(--color-bg-primary);
  border-color: var(--color-accent);
}

textarea {
  resize: vertical;
  font-family: monospace;
  font-size: 11px;
}

.form-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.cancel-btn {
  flex: 1;
  padding: 6px;
  font-size: 12px;
  background: var(--color-bg-secondary);
}

.submit-btn {
  flex: 1;
  padding: 6px;
  font-size: 12px;
  background: var(--color-accent);
  color: var(--color-bg-primary);
}

/* Fold 트랜지션 */
.fold-enter-active,
.fold-leave-active {
  transition: all 0.2s ease;
  max-height: 500px;
}

.fold-enter-from,
.fold-leave-to {
  max-height: 0;
  opacity: 0;
}
</style>
