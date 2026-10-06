import { apiClient } from './client'
import type { PaginatedResult, Settlement } from '@/types/finance'

export async function fetchSettlements(params?: {
  payeeType?: string
  status?: string
  page?: number
  limit?: number
}): Promise<PaginatedResult<Settlement>> {
  const { data } = await apiClient.get<PaginatedResult<Settlement>>('/settlements', { params })
  return data
}

export async function markSettlementPaid(id: string): Promise<Settlement> {
  const { data } = await apiClient.patch<Settlement>(`/settlements/${id}/mark-paid`)
  return data
}
