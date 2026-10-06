import { apiClient } from './client'
import type { Customer, PaginatedResult, UserStatus } from '@/types/entities'

export async function fetchCustomers(params: {
  page?: number
  limit?: number
  q?: string
  status?: UserStatus
} = {}): Promise<PaginatedResult<Customer>> {
  const { data } = await apiClient.get<PaginatedResult<Customer>>('/users/customers', { params })
  return data
}

export async function updateCustomerStatus(id: string, status: UserStatus): Promise<Customer> {
  const { data } = await apiClient.patch<Customer>(`/users/customers/${id}`, { status })
  return data
}
