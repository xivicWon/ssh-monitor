import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { SshConnection, ConnectionFormData, ServerInfoResponse, DirectoryEntry } from '@/types'

const STORAGE_KEY = 'ssh-monitor-connections'

interface CommandHistoryItem {
  command: string
  timestamp: Date
}

const MAX_HISTORY = 100

export const useConnectionStore = defineStore('connection', () => {
  const connections = ref<SshConnection[]>([])
  const activeConnectionId = ref<string | null>(null)
  const serverInfo = ref<ServerInfoResponse | null>(null)
  const commandHistory = ref<CommandHistoryItem[]>([])
  const pendingCommand = ref<string | null>(null)
  const pendingDirectoryPath = ref<string | null>(null)
  const syncToTerminalRequested = ref(false)

  // 디렉토리 관련 상태
  const currentPath = ref<string>('')
  const directoryEntries = ref<DirectoryEntry[]>([])
  const isLoadingDirectory = ref(false)

  const activeConnection = computed(() =>
    connections.value.find(c => c.id === activeConnectionId.value) || null
  )

  function loadFromStorage() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        connections.value = parsed
      }
    } catch (e) {
      console.error('Failed to load connections from storage:', e)
    }
  }

  function saveToStorage() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(connections.value))
    } catch (e) {
      console.error('Failed to save connections to storage:', e)
    }
  }

  function addConnection(formData: ConnectionFormData): SshConnection {
    const newConnection: SshConnection = {
      id: crypto.randomUUID(),
      name: formData.name,
      host: formData.host,
      port: formData.port,
      username: formData.username,
      authType: formData.authType,
      password: formData.authType === 'password' ? formData.password : undefined,
      privateKey: formData.authType === 'privateKey' ? formData.privateKey : undefined,
      createdAt: new Date().toISOString()
    }
    connections.value.push(newConnection)
    saveToStorage()
    return newConnection
  }

  function updateConnection(id: string, formData: Partial<ConnectionFormData>) {
    const index = connections.value.findIndex(c => c.id === id)
    if (index !== -1) {
      connections.value[index] = {
        ...connections.value[index],
        ...formData
      }
      saveToStorage()
    }
  }

  function removeConnection(id: string) {
    const index = connections.value.findIndex(c => c.id === id)
    if (index !== -1) {
      connections.value.splice(index, 1)
      if (activeConnectionId.value === id) {
        activeConnectionId.value = null
        serverInfo.value = null
      }
      saveToStorage()
    }
  }

  function setActiveConnection(id: string | null) {
    activeConnectionId.value = id
    if (id === null) {
      serverInfo.value = null
    }
  }

  function updateLastConnected(id: string) {
    const connection = connections.value.find(c => c.id === id)
    if (connection) {
      connection.lastConnectedAt = new Date().toISOString()
      saveToStorage()
    }
  }

  function setServerInfo(info: ServerInfoResponse | null) {
    serverInfo.value = info
  }

  function getConnectionCredentials(id: string): { password?: string; privateKey?: string } | null {
    const connection = connections.value.find(c => c.id === id)
    if (!connection) return null
    return {
      password: connection.password,
      privateKey: connection.privateKey
    }
  }

  function setConnectionCredentials(id: string, password?: string, privateKey?: string) {
    const connection = connections.value.find(c => c.id === id)
    if (connection) {
      if (password !== undefined) connection.password = password
      if (privateKey !== undefined) connection.privateKey = privateKey
      saveToStorage()
    }
  }

  function clearConnectionCredentials(id: string) {
    const connection = connections.value.find(c => c.id === id)
    if (connection) {
      connection.password = undefined
      connection.privateKey = undefined
      saveToStorage()
    }
  }

  function addCommand(command: string) {
    const trimmed = command.trim()
    if (!trimmed) return

    commandHistory.value.push({
      command: trimmed,
      timestamp: new Date()
    })

    // 최대 개수 초과시 오래된 항목 제거
    if (commandHistory.value.length > MAX_HISTORY) {
      commandHistory.value.shift()
    }
  }

  function clearHistory() {
    commandHistory.value = []
  }

  function setPendingCommand(command: string | null) {
    pendingCommand.value = command
  }

  function setPendingDirectoryPath(path: string | null) {
    pendingDirectoryPath.value = path
  }

  function requestSyncToTerminal() {
    console.log('[connectionStore] requestSyncToTerminal called, setting to true')
    syncToTerminalRequested.value = true
    console.log('[connectionStore] syncToTerminalRequested is now:', syncToTerminalRequested.value)
  }

  function clearSyncToTerminalRequest() {
    console.log('[connectionStore] clearSyncToTerminalRequest called, setting to false')
    syncToTerminalRequested.value = false
  }

  function setDirectoryData(path: string, entries: DirectoryEntry[]) {
    currentPath.value = path
    directoryEntries.value = entries
  }

  function setLoadingDirectory(loading: boolean) {
    isLoadingDirectory.value = loading
  }

  function clearDirectoryData() {
    currentPath.value = ''
    directoryEntries.value = []
  }

  loadFromStorage()

  return {
    connections,
    activeConnectionId,
    activeConnection,
    serverInfo,
    commandHistory,
    pendingCommand,
    pendingDirectoryPath,
    syncToTerminalRequested,
    currentPath,
    directoryEntries,
    isLoadingDirectory,
    addConnection,
    updateConnection,
    removeConnection,
    setActiveConnection,
    updateLastConnected,
    setServerInfo,
    getConnectionCredentials,
    setConnectionCredentials,
    clearConnectionCredentials,
    addCommand,
    clearHistory,
    setPendingCommand,
    setPendingDirectoryPath,
    requestSyncToTerminal,
    clearSyncToTerminalRequest,
    setDirectoryData,
    setLoadingDirectory,
    clearDirectoryData
  }
})
