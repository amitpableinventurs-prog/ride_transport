import { apiClient } from './client'
import type { ApprovalStatus, Driver, PaginatedResult, ServiceType, UserStatus } from '@/types/entities'

export async function fetchDrivers(params: {
  page?: number
  limit?: number
  q?: string
  serviceType?: ServiceType
  status?: UserStatus
  approvalStatus?: ApprovalStatus
} = {}): Promise<PaginatedResult<Driver>> {
  const { data } = await apiClient.get<PaginatedResult<Driver>>('/users/drivers', { params })
  return data
}

export async function updateDriver(
  id: string,
  patch: Partial<{
    approvalStatus: ApprovalStatus
    status: UserStatus
    rejectionReason: string
    name: string
    email: string
    gender: 'male' | 'female' | 'other'
    dateOfBirth: string
  }>,
): Promise<Driver> {
  const { data } = await apiClient.patch<Driver>(`/users/drivers/${id}`, patch)
  return data
}

/** Deletes the account with its vehicles, documents and wallet; past trips are kept. */
export async function deleteDriver(id: string): Promise<void> {
  await apiClient.delete(`/users/drivers/${id}`)
}
