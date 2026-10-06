import { apiClient } from './client'
import type { ServiceArea } from '@/types/marketing'

export async function fetchServiceAreas(params?: { status?: string; q?: string }): Promise<ServiceArea[]> {
  const { data } = await apiClient.get<ServiceArea[]>('/service-areas', { params })
  return data
}

export async function createServiceArea(input: Partial<ServiceArea>): Promise<ServiceArea> {
  const { data } = await apiClient.post<ServiceArea>('/service-areas', input)
  return data
}

export async function updateServiceArea(id: string, patch: Partial<ServiceArea>): Promise<ServiceArea> {
  const { data } = await apiClient.patch<ServiceArea>(`/service-areas/${id}`, patch)
  return data
}

export async function deleteServiceArea(id: string): Promise<void> {
  await apiClient.delete(`/service-areas/${id}`)
}
