import { apiClient } from './client'
import type { OwnerType, PaginatedResult, ServiceMode, Vehicle } from '@/types/entities'

export async function fetchVehicles(params: {
  page?: number
  limit?: number
  q?: string
  status?: 'active' | 'inactive' | 'blocked'
  serviceMode?: ServiceMode
  ownerType?: OwnerType
} = {}): Promise<PaginatedResult<Vehicle>> {
  const { data } = await apiClient.get<PaginatedResult<Vehicle>>('/fleet/vehicles', { params })
  return data
}

export async function createVehicle(input: {
  registrationNumber: string
  model: string
  manufacturer?: string
  vehicleType: string
  serviceMode: ServiceMode
  categoryKey: string
  ownerType: OwnerType
  ownerId: string
  capacity?: string
}): Promise<Vehicle> {
  const { data } = await apiClient.post<Vehicle>('/fleet/vehicles', input)
  return data
}

export async function updateVehicle(
  id: string,
  patch: Partial<{
    model: string
    manufacturer: string
    vehicleType: string
    capacity: string
    status: 'active' | 'inactive' | 'blocked'
    documentsStatus: 'pending' | 'verified' | 'rejected' | 'expired'
  }>,
): Promise<Vehicle> {
  const { data } = await apiClient.patch<Vehicle>(`/fleet/vehicles/${id}`, patch)
  return data
}
