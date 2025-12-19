import { ref, onUnmounted } from 'vue'
import { Client, IMessage } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import type { TerminalMessage, TerminalConnectMessage, TerminalInputMessage, TerminalResizeMessage, DirectoryListRequest, DirectoryListResponse } from '@/types'

const WS_URL = import.meta.env.VITE_WS_URL || '/ws'

export function useWebSocket() {
  const isConnected = ref(false)
  const client = ref<Client | null>(null)
  const sessionId = ref<string | null>(null)

  function connect(
    onMessage: (message: TerminalMessage) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const stompClient = new Client({
        webSocketFactory: () => new SockJS(`${WS_URL}/terminal`),
        reconnectDelay: 5000,
        heartbeatIncoming: 10000,
        heartbeatOutgoing: 10000,
        onConnect: () => {
          isConnected.value = true
          resolve()
        },
        onStompError: (frame) => {
          const error = new Error(frame.body || 'STOMP error')
          onError?.(error)
          reject(error)
        },
        onWebSocketClose: () => {
          isConnected.value = false
        }
      })

      client.value = stompClient
      stompClient.activate()
    })
  }

  function subscribeToSession(
    sId: string,
    onMessage: (message: TerminalMessage) => void
  ) {
    if (!client.value || !isConnected.value) {
      throw new Error('WebSocket not connected')
    }

    sessionId.value = sId

    client.value.subscribe(`/topic/terminal/${sId}`, (message: IMessage) => {
      try {
        const terminalMessage: TerminalMessage = JSON.parse(message.body)
        onMessage(terminalMessage)
      } catch (e) {
        console.error('Failed to parse terminal message:', e)
      }
    })
  }

  function sendConnect(message: TerminalConnectMessage) {
    if (!client.value || !isConnected.value) {
      throw new Error('WebSocket not connected')
    }

    client.value.publish({
      destination: '/app/terminal/connect',
      body: JSON.stringify(message)
    })
  }

  function sendInput(message: TerminalInputMessage) {
    if (!client.value || !isConnected.value) {
      return
    }

    client.value.publish({
      destination: '/app/terminal/input',
      body: JSON.stringify(message)
    })
  }

  function sendDisconnect(sId: string) {
    if (!client.value || !isConnected.value) {
      return
    }

    client.value.publish({
      destination: '/app/terminal/disconnect',
      body: JSON.stringify({ sessionId: sId })
    })
  }

  function sendResize(message: TerminalResizeMessage) {
    if (!client.value || !isConnected.value) {
      return
    }

    client.value.publish({
      destination: '/app/terminal/resize',
      body: JSON.stringify(message)
    })
  }

  function subscribeToDirectory(
    sId: string,
    onDirectory: (response: DirectoryListResponse) => void
  ) {
    if (!client.value || !isConnected.value) {
      return
    }

    client.value.subscribe(`/topic/terminal/${sId}/directory`, (message: IMessage) => {
      try {
        const response: DirectoryListResponse = JSON.parse(message.body)
        onDirectory(response)
      } catch (e) {
        console.error('Failed to parse directory response:', e)
      }
    })
  }

  function sendListDirectory(request: DirectoryListRequest) {
    if (!client.value || !isConnected.value) {
      return
    }

    client.value.publish({
      destination: '/app/terminal/listdir',
      body: JSON.stringify(request)
    })
  }

  function subscribeToPwd(
    sId: string,
    onPwd: (path: string) => void
  ) {
    if (!client.value || !isConnected.value) {
      return
    }

    client.value.subscribe(`/topic/terminal/${sId}/pwd`, (message: IMessage) => {
      onPwd(message.body)
    })
  }

  function sendPwd(sId: string) {
    if (!client.value || !isConnected.value) {
      return
    }

    client.value.publish({
      destination: '/app/terminal/pwd',
      body: sId
    })
  }

  function disconnect() {
    if (sessionId.value) {
      sendDisconnect(sessionId.value)
    }
    if (client.value) {
      client.value.deactivate()
      client.value = null
    }
    isConnected.value = false
    sessionId.value = null
  }

  onUnmounted(() => {
    disconnect()
  })

  return {
    isConnected,
    sessionId,
    connect,
    subscribeToSession,
    subscribeToDirectory,
    subscribeToPwd,
    sendConnect,
    sendInput,
    sendDisconnect,
    sendResize,
    sendListDirectory,
    sendPwd,
    disconnect
  }
}
