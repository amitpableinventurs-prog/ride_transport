import type { ReactNode } from 'react'
import { useAuthStore } from '@/store/authStore'
import type { PermissionKey } from '@/types/rbac'

interface PermissionGateProps {
  permission: PermissionKey
  children: ReactNode
  fallback?: ReactNode
}

export function PermissionGate({ permission, children, fallback = null }: PermissionGateProps) {
  const hasPermission = useAuthStore((s) => s.hasPermission(permission))
  return hasPermission ? <>{children}</> : <>{fallback}</>
}
