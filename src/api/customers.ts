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

export async function updateCustomer(
  id: string,
  patch: Partial<{
    status: UserStatus
    name: string
    email: string
    city: string
    gender: 'male' | 'female' | 'other'
    dateOfBirth: string
  }>,
): Promise<Customer> {
  const { data } = await apiClient.patch<Customer>(`/users/customers/${id}`, patch)
  return data
}
