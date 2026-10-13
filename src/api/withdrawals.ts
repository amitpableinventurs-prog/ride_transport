import { apiClient } from './client'
import type { PaginatedResult, Withdrawal } from '@/types/finance'

export async function fetchWithdrawals(params?: { status?: string; page?: number; limit?: number }): Promise<PaginatedResult<Withdrawal>> {
  const { data } = await apiClient.get<PaginatedResult<Withdrawal>>('/withdrawals', { params })
  return data
}

export async function markWithdrawalProcessing(id: string): Promise<Withdrawal> {
  const { data } = await apiClient.patch<Withdrawal>(`/withdrawals/${id}/processing`)
  return data
}

export async function markWithdrawalPaid(id: string, reference: string): Promise<Withdrawal> {
  const { data } = await apiClient.patch<Withdrawal>(`/withdrawals/${id}/paid`, { reference })
  return data
}

export async function rejectWithdrawal(id: string, reason: string): Promise<Withdrawal> {
  const { data } = await apiClient.patch<Withdrawal>(`/withdrawals/${id}/reject`, { reason })
  return data
}
