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
