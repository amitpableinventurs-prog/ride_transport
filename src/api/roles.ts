import { apiClient } from './client'
import type { PermissionKey, Role, RoleKey } from '@/types/rbac'

export async function fetchRoles(): Promise<Role[]> {
  const { data } = await apiClient.get<Role[]>('/roles')
  return data
}

export async function updateRolePermissions(key: RoleKey, permissions: PermissionKey[]): Promise<Role> {
  const { data } = await apiClient.patch<Role>(`/roles/${key}`, { permissions })
  return data
}
