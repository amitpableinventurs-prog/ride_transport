import { apiClient } from './client'
import type { AuditLogEntry } from '@/types/audit'

export async function fetchAuditLogs(): Promise<AuditLogEntry[]> {
  const { data } = await apiClient.get<AuditLogEntry[]>('/audit-logs')
  return data
}
