import { apiClient } from './client'
import type { ApprovalStatus, PaginatedResult, TransportPartner, UserStatus } from '@/types/entities'

export async function fetchPartners(params: {
  page?: number
  limit?: number
  q?: string
  status?: UserStatus
  approvalStatus?: ApprovalStatus
} = {}): Promise<PaginatedResult<TransportPartner>> {
  const { data } = await apiClient.get<PaginatedResult<TransportPartner>>('/users/partners', { params })
  return data
}

export async function updatePartner(
  id: string,
  patch: Partial<{ approvalStatus: ApprovalStatus; status: UserStatus }>,
): Promise<TransportPartner> {
  const { data } = await apiClient.patch<TransportPartner>(`/users/partners/${id}`, patch)
  return data
}
