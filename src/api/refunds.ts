import { apiClient } from './client'
import type { PaginatedResult, Refund } from '@/types/finance'

export async function fetchRefunds(params?: { status?: string; page?: number; limit?: number }): Promise<PaginatedResult<Refund>> {
  const { data } = await apiClient.get<PaginatedResult<Refund>>('/refunds', { params })
  return data
}

export async function approveRefund(id: string): Promise<Refund> {
  const { data } = await apiClient.patch<Refund>(`/refunds/${id}/approve`)
  return data
}

export async function rejectRefund(id: string, reason?: string): Promise<Refund> {
  const { data } = await apiClient.patch<Refund>(`/refunds/${id}/reject`, { reason })
  return data
}

export async function processRefund(id: string): Promise<Refund> {
  const { data } = await apiClient.patch<Refund>(`/refunds/${id}/process`)
  return data
}
