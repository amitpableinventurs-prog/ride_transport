import { apiClient } from './client'
import type { SosRequest } from '@/types/booking'

export async function fetchSosRequests(): Promise<SosRequest[]> {
  const { data } = await apiClient.get<SosRequest[]>('/sos')
  return data
}

export async function updateSosRequest(
  id: string,
  input: { status?: 'open' | 'acknowledged' | 'resolved'; note?: string },
): Promise<SosRequest> {
  const { data } = await apiClient.patch<SosRequest>(`/sos/${id}`, input)
  return data
}
