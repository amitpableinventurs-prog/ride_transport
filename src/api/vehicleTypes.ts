import { apiClient } from './client'
import type { PaginatedResult, ServiceMode, VehicleType } from '@/types/entities'

export async function fetchVehicleTypes(params: {
  page?: number
  limit?: number
  q?: string
  serviceMode?: ServiceMode
  status?: 'active' | 'inactive'
} = {}): Promise<PaginatedResult<VehicleType>> {
  const { data } = await apiClient.get<PaginatedResult<VehicleType>>('/fleet/vehicle-types', { params })
  return data
}

export async function createVehicleType(input: {
  name: string
  serviceMode: ServiceMode
  capacityLabel?: string
}): Promise<VehicleType> {
  const { data } = await apiClient.post<VehicleType>('/fleet/vehicle-types', input)
  return data
}

export async function updateVehicleType(
  id: string,
  patch: Partial<{ name: string; serviceMode: ServiceMode; capacityLabel: string; status: 'active' | 'inactive' }>,
): Promise<VehicleType> {
  const { data } = await apiClient.patch<VehicleType>(`/fleet/vehicle-types/${id}`, patch)
  return data
}
