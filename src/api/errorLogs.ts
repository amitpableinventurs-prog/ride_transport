import { apiClient } from './client'
import type { ErrorLogEntry, ErrorLogList, ErrorLogStatus, ErrorLogSummary } from '@/types/errorLogs'

export async function fetchErrorLogs(params?: {
  source?: string
  level?: string
  status?: string
  q?: string
  page?: number
  limit?: number
}): Promise<ErrorLogList> {
  const { data } = await apiClient.get<ErrorLogList>('/error-logs', { params })
  return data
}

export async function fetchErrorLogSummary(): Promise<ErrorLogSummary> {
  const { data } = await apiClient.get<ErrorLogSummary>('/error-logs/summary')
  return data
}

export async function fetchErrorLog(id: string): Promise<ErrorLogEntry> {
  const { data } = await apiClient.get<ErrorLogEntry>(`/error-logs/${id}`)
  return data
}

export async function setErrorLogStatus(id: string, status: ErrorLogStatus): Promise<ErrorLogEntry> {
  const { data } = await apiClient.patch<ErrorLogEntry>(`/error-logs/${id}`, { status })
  return data
}

export async function resolveSimilarErrorLogs(id: string): Promise<{ resolved: number }> {
  const { data } = await apiClient.post<{ resolved: number }>(`/error-logs/${id}/resolve-similar`)
  return data
}
