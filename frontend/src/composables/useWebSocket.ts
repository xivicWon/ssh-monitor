import { ref, onUnmounted } from 'vue'
import { Client, IMessage, StompSubscription } from '@stomp/stompjs'
import SockJS from 'sockjs-client'
import type { TerminalMessage, TerminalConnectMessage, TerminalInputMessage, TerminalResizeMessage, DirectoryListRequest, DirectoryListResponse } from '@/types'

const WS_URL = import.meta.env.VITE_WS_URL || '/ws'

interface SessionSubscriptions {
  terminal?: StompSubscription
  directory?: StompSubscription
  pwd?: StompSubscription
}

interface SessionPingState {
  intervalId?: number
  lastPongTime?: number
  timeoutId?: number
}

// 싱글톤 상태 (모든 컴포넌트에서 공유)
const isConnected = ref(false)
const client = ref<Client | null>(null)
const sessionId = ref<string | null>(null) // 레거시 호환용
const subscriptions = ref<Map<string, SessionSubscriptions>>(new Map())
const pingStates = ref<Map<string, SessionPingState>>(new Map())

export function useWebSocket() {

  function connect(
    _onMessage: (message: TerminalMessage) => void,
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
  ): () => void {
    if (!client.value || !isConnected.value) {
      throw new Error('WebSocket not connected')
    }

    sessionId.value = sId // 레거시 호환

    const subscription = client.value.subscribe(`/topic/terminal/${sId}`, (message: IMessage) => {
      try {
        const terminalMessage: TerminalMessage = JSON.parse(message.body)
        onMessage(terminalMessage)
      } catch (e) {
        console.error('Failed to parse terminal message:', e)
      }
    })

    // 구독 저장
    const existing = subscriptions.value.get(sId) || {}
    subscriptions.value.set(sId, { ...existing, terminal: subscription })

    // unsubscribe 함수 반환
    return () => {
      subscription.unsubscribe()
      const subs = subscriptions.value.get(sId)
      if (subs) {
        delete subs.terminal
        if (!subs.terminal && !subs.directory && !subs.pwd) {
          subscriptions.value.delete(sId)
        }
      }
    }
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
  ): (() => void) | undefined {
    if (!client.value || !isConnected.value) {
      return undefined
    }

    const subscription = client.value.subscribe(`/topic/terminal/${sId}/directory`, (message: IMessage) => {
      try {
        const response: DirectoryListResponse = JSON.parse(message.body)
        onDirectory(response)
      } catch (e) {
        console.error('Failed to parse directory response:', e)
      }
    })

    // 구독 저장
    const existing = subscriptions.value.get(sId) || {}
    subscriptions.value.set(sId, { ...existing, directory: subscription })

    return () => {
      subscription.unsubscribe()
      const subs = subscriptions.value.get(sId)
      if (subs) {
        delete subs.directory
        if (!subs.terminal && !subs.directory && !subs.pwd) {
          subscriptions.value.delete(sId)
        }
      }
    }
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
  ): (() => void) | undefined {
    if (!client.value || !isConnected.value) {
      return undefined
    }

    const subscription = client.value.subscribe(`/topic/terminal/${sId}/pwd`, (message: IMessage) => {
      onPwd(message.body)
    })

    // 구독 저장
    const existing = subscriptions.value.get(sId) || {}
    subscriptions.value.set(sId, { ...existing, pwd: subscription })

    return () => {
      subscription.unsubscribe()
      const subs = subscriptions.value.get(sId)
      if (subs) {
        delete subs.pwd
        if (!subs.terminal && !subs.directory && !subs.pwd) {
          subscriptions.value.delete(sId)
        }
      }
    }
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

  function sendPing(sId: string) {
    if (!client.value || !isConnected.value) {
      return
    }

    client.value.publish({
      destination: '/app/terminal/ping',
      body: sId
    })
  }

  function startPingTimer(sId: string, onTimeout: () => void) {
    // 기존 타이머가 있으면 정리
    stopPingTimer(sId)

    // 20초마다 ping 전송
    const intervalId = window.setInterval(() => {
      sendPing(sId)

      // 10초 타임아웃 설정
      const timeoutId = window.setTimeout(() => {
        console.warn(`Ping timeout for session ${sId}`)
        onTimeout()
      }, 10000)

      const currentState = pingStates.value.get(sId) || {}
      pingStates.value.set(sId, {
        ...currentState,
        timeoutId
      })
    }, 20000)

    pingStates.value.set(sId, { intervalId })
  }

  function handlePong(sId: string) {
    const state = pingStates.value.get(sId)
    if (state?.timeoutId) {
      clearTimeout(state.timeoutId)
    }
    pingStates.value.set(sId, {
      ...state,
      lastPongTime: Date.now()
    })
  }

  function stopPingTimer(sId: string) {
    const state = pingStates.value.get(sId)
    if (state) {
      if (state.intervalId) clearInterval(state.intervalId)
      if (state.timeoutId) clearTimeout(state.timeoutId)
      pingStates.value.delete(sId)
    }
  }

  // 특정 세션의 모든 구독 해제
  function unsubscribeSession(sId: string) {
    const subs = subscriptions.value.get(sId)
    if (subs) {
      subs.terminal?.unsubscribe()
      subs.directory?.unsubscribe()
      subs.pwd?.unsubscribe()
      subscriptions.value.delete(sId)
    }
  }

  // 특정 세션 연결 해제
  function disconnectSession(sId: string) {
    sendDisconnect(sId)
    unsubscribeSession(sId)
    stopPingTimer(sId)
  }

  // 전체 연결 해제 (레거시 호환 + 모든 세션)
  function disconnect() {
    // 모든 세션 구독 해제
    subscriptions.value.forEach((subs, sId) => {
      sendDisconnect(sId)
      subs.terminal?.unsubscribe()
      subs.directory?.unsubscribe()
      subs.pwd?.unsubscribe()
    })
    subscriptions.value.clear()

    // 모든 ping 타이머 정리
    pingStates.value.forEach((_, sId) => {
      stopPingTimer(sId)
    })

    // 레거시 단일 세션 처리
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
    subscriptions,
    pingStates,
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
    sendPing,
    startPingTimer,
    handlePong,
    stopPingTimer,
    unsubscribeSession,
    disconnectSession,
    disconnect
  }
}
