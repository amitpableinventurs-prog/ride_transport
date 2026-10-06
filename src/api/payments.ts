import { apiClient } from './client'
import type { PaginatedResult, Payment } from '@/types/finance'

export async function fetchPayments(params?: {
  status?: string
  method?: string
  q?: string
  page?: number
  limit?: number
}): Promise<PaginatedResult<Payment>> {
  const { data } = await apiClient.get<PaginatedResult<Payment>>('/payments', { params })
  return data
}
