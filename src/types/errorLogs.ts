export type ErrorSource = 'customer_app' | 'rider_app' | 'partner_app' | 'api'
export type ErrorLevel = 'fatal' | 'error' | 'warning'
export type ErrorLogStatus = 'open' | 'resolved'

export interface ErrorLogEntry {
  id: string
  source: ErrorSource
  level: ErrorLevel
  message: string
  /** Only in the detail response (GET /error-logs/:id). */
  stack?: string
  screen?: string
  platform?: 'android' | 'ios' | 'web' | 'server'
  appVersion?: string
  osVersion?: string
  deviceModel?: string
  userType?: 'customer' | 'driver' | 'partner' | 'admin'
  userId?: string | null
  userName?: string
  userPhone?: string
  /** Only in the detail response. */
  context?: Record<string, string | number | boolean>
  ip?: string
  occurredAt: string
  status: ErrorLogStatus
  resolvedAt?: string
  resolvedBy?: string
  createdAt: string
}

export interface ErrorLogList {
  items: ErrorLogEntry[]
  total: number
  page: number
  limit: number
}

export interface ErrorLogSummary {
  open: number
  openFatal: number
  last24h: number
  openBySource: Record<ErrorSource, number>
}
