import type { PermissionKey, RoleKey } from './rbac'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: RoleKey
  roleName: string
  permissions: PermissionKey[]
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}
