import { apiClient } from './client'
import type { PricingRule } from '@/types/finance'

export async function fetchPricingRules(params?: { mode?: string; categoryKey?: string; status?: string }): Promise<PricingRule[]> {
  const { data } = await apiClient.get<PricingRule[]>('/pricing', { params })
  return data
}

export async function createPricingRule(input: Partial<PricingRule>): Promise<PricingRule> {
  const { data } = await apiClient.post<PricingRule>('/pricing', input)
  return data
}

export async function updatePricingRule(id: string, patch: Partial<PricingRule>): Promise<PricingRule> {
  const { data } = await apiClient.patch<PricingRule>(`/pricing/${id}`, patch)
  return data
}

export async function deactivatePricingRule(id: string): Promise<PricingRule> {
  const { data } = await apiClient.delete<PricingRule>(`/pricing/${id}`)
  return data
}
