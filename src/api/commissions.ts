import { apiClient } from './client'
import type { CommissionRule } from '@/types/finance'

export async function fetchCommissionRules(params?: { appliesTo?: string; categoryKey?: string; status?: string }): Promise<CommissionRule[]> {
  const { data } = await apiClient.get<CommissionRule[]>('/commissions', { params })
  return data
}

export async function createCommissionRule(input: Partial<CommissionRule>): Promise<CommissionRule> {
  const { data } = await apiClient.post<CommissionRule>('/commissions', input)
  return data
}

export async function updateCommissionRule(id: string, patch: Partial<CommissionRule>): Promise<CommissionRule> {
  const { data } = await apiClient.patch<CommissionRule>(`/commissions/${id}`, patch)
  return data
}

export async function deactivateCommissionRule(id: string): Promise<CommissionRule> {
  const { data } = await apiClient.delete<CommissionRule>(`/commissions/${id}`)
  return data
}
