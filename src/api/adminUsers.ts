import { apiClient } from './client'
import type { AdminUser, RoleKey } from '@/types/rbac'

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { data } = await apiClient.get<AdminUser[]>('/admins')
  return data
}

export async function createAdminUser(input: { name: string; email: string; phone: string; role: RoleKey }): Promise<AdminUser> {
  const { data } = await apiClient.post<AdminUser>('/admins', input)
  return data
}

export async function updateAdminUser(id: string, patch: Partial<Pick<AdminUser, 'name' | 'phone' | 'role' | 'status'>>): Promise<AdminUser> {
  const { data } = await apiClient.patch<AdminUser>(`/admins/${id}`, patch)
  return data
}
