import { ref } from 'vue'
import type {
  SshConnection,
  ConnectionValidationResponse,
  ServerInfoResponse
} from '@/types'

const API_URL = import.meta.env.VITE_API_URL || '/api'

export function useSshConnection() {
  const isValidating = ref(false)
  const isLoadingInfo = ref(false)
  const error = ref<string | null>(null)

  async function validateConnection(connection: SshConnection): Promise<ConnectionValidationResponse> {
    isValidating.value = true
    error.value = null

    try {
      const response = await fetch(`${API_URL}/connections/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          host: connection.host,
          port: connection.port,
          username: connection.username,
          authType: connection.authType,
          password: connection.password,
          privateKey: connection.privateKey
        })
      })

      const data: ConnectionValidationResponse = await response.json()

      if (!data.valid) {
        error.value = data.message
      }

      return data
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Network error'
      error.value = message
      return {
        valid: false,
        message,
        errorCode: 'NETWORK_ERROR'
      }
    } finally {
      isValidating.value = false
    }
  }

  async function getServerInfo(connection: SshConnection): Promise<ServerInfoResponse | null> {
    isLoadingInfo.value = true
    error.value = null

    try {
      const response = await fetch(`${API_URL}/connections/info`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          host: connection.host,
          port: connection.port,
          username: connection.username,
          authType: connection.authType,
          password: connection.password,
          privateKey: connection.privateKey
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        error.value = errorData.message || 'Failed to get server info'
        return null
      }

      return await response.json()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Network error'
      return null
    } finally {
      isLoadingInfo.value = false
    }
  }

  return {
    isValidating,
    isLoadingInfo,
    error,
    validateConnection,
    getServerInfo
  }
}
