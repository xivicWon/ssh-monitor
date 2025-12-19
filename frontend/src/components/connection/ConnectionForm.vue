<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useConnectionStore } from '@/stores/connectionStore'
import type { ConnectionFormData, AuthType } from '@/types'

const props = defineProps<{
  editingId: string | null
}>()

const emit = defineEmits<{
  close: []
}>()

const connectionStore = useConnectionStore()

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

onMounted(() => {
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
  }
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
  <div class="form-overlay" @click.self="handleCancel">
    <div class="form-container">
      <div class="form-header">
        <h3>{{ isEditing ? '연결 편집' : '새 연결 추가' }}</h3>
        <button class="close-btn" @click="handleCancel">✕</button>
      </div>

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
            rows="6"
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
  </div>
</template>

<style scoped>
.form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.form-container {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  width: 100%;
  max-width: 420px;
  max-height: 90vh;
  overflow-y: auto;
}

.form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--color-border);
}

.form-header h3 {
  font-size: 16px;
  font-weight: 600;
}

.close-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  font-size: 16px;
}

form {
  padding: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.form-row {
  display: flex;
  gap: 12px;
}

.flex-grow {
  flex: 1;
}

.port-group {
  width: 100px;
}

.auth-toggle {
  display: flex;
  gap: 8px;
}

.auth-toggle button {
  flex: 1;
  padding: 8px;
  background: var(--color-bg-tertiary);
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
  font-size: 12px;
}

.form-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.cancel-btn {
  flex: 1;
  background: var(--color-bg-tertiary);
}

.submit-btn {
  flex: 1;
  background: var(--color-accent);
  color: var(--color-bg-primary);
}
</style>
