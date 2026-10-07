import { apiClient } from './client'
import type { ServiceCategory, ServiceMode } from '@/types/booking'

export async function fetchCategories(mode?: ServiceMode): Promise<ServiceCategory[]> {
  const { data } = await apiClient.get<ServiceCategory[]>('/service-categories', { params: mode ? { mode } : undefined })
  return data
}

export async function createCategory(
  input: Partial<Pick<ServiceCategory, 'mode' | 'key' | 'name' | 'description' | 'icon' | 'seats' | 'capacityLabel' | 'vehicleType' | 'status' | 'sortOrder'>>,
): Promise<ServiceCategory> {
  const { data } = await apiClient.post<ServiceCategory>('/service-categories', input)
  return data
}

export async function updateCategory(
  id: string,
  patch: Partial<Pick<ServiceCategory, 'name' | 'description' | 'icon' | 'seats' | 'capacityLabel' | 'vehicleType' | 'status' | 'sortOrder'>>,
): Promise<ServiceCategory> {
  const { data } = await apiClient.patch<ServiceCategory>(`/service-categories/${id}`, patch)
  return data
}

export async function deleteCategory(id: string): Promise<void> {
  await apiClient.delete(`/service-categories/${id}`)
}
