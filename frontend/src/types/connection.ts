export type AuthType = 'password' | 'privateKey'

export interface SshConnection {
  id: string
  name: string
  host: string
  port: number
  username: string
  authType: AuthType
  password?: string
  privateKey?: string
  createdAt: string
  lastConnectedAt?: string
}

export interface ConnectionFormData {
  name: string
  host: string
  port: number
  username: string
  authType: AuthType
  password: string
  privateKey: string
}

export interface ServerInfo {
  hostname: string
  osType: string
  serverTime: string
}

export interface ConnectionValidationResponse {
  valid: boolean
  message: string
  serverInfo?: ServerInfo
  errorCode?: string
}

export interface ServerInfoResponse {
  hostname: string
  osType: string
  osVersion: string
  uptime: string
  cpuCores: number
  memoryTotal: string
  diskUsage: string
}
