export interface TerminalConfig {
  cols: number
  rows: number
  term: string
}

export interface TerminalConnectMessage {
  sessionId: string
  host: string
  port: number
  username: string
  authType: 'password' | 'privateKey'
  password?: string
  privateKey?: string
  terminalConfig: TerminalConfig
}

export interface TerminalInputMessage {
  sessionId: string
  data: string
}

export interface TerminalDisconnectMessage {
  sessionId: string
}

export interface TerminalResizeMessage {
  sessionId: string
  cols: number
  rows: number
}

export type TerminalMessageType =
  | 'connected'
  | 'output'
  | 'status'
  | 'error'
  | 'disconnected'
  | 'resized'
  | 'ping'
  | 'pong'
  | 'health_check'

export interface TerminalMessage {
  type: TerminalMessageType
  sessionId: string
  data?: string
  status?: string
  message?: string
  errorCode?: string
  cols?: number
  rows?: number
}

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'

export interface DirectoryEntry {
  name: string
  type: 'file' | 'directory' | 'link'
  permissions: string
  owner: string
  group: string
  size: number
  modified: string
}

export interface DirectoryListResponse {
  success: boolean
  currentPath: string
  entries: DirectoryEntry[]
  errorMessage?: string
}

export interface DirectoryListRequest {
  sessionId: string
  path: string
}

export interface CommandHistoryItem {
  command: string
  timestamp: Date
}

export interface TerminalSession {
  id: string                    // 고유 세션 ID (탭 ID)
  connectionId: string          // SshConnection.id 참조
  sessionId: string             // WebSocket 세션 ID
  status: ConnectionStatus
  serverInfo: import('./connection').ServerInfoResponse | null
  commandHistory: CommandHistoryItem[]
  currentPath: string
  directoryEntries: DirectoryEntry[]
  isLoadingDirectory: boolean
  autoConnect?: boolean         // 마운트 시 자동 연결 여부 (새 세션에만 true)
}

// 분할 화면 레이아웃 타입
export type SplitDirection = 'horizontal' | 'vertical'

export interface SplitPane {
  id: string
  type: 'terminal' | 'split'
  sessionId?: string           // type이 'terminal'일 때
  direction?: SplitDirection   // type이 'split'일 때
  children?: SplitPane[]       // type이 'split'일 때
  size?: number                // 비율 (0-100)
}
