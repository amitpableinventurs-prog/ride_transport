import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import type { PermissionKey } from '@/types/rbac'
import { LoadingScreen } from './LoadingScreen'

export function ProtectedRoute({ permission }: { permission?: PermissionKey }) {
  const status = useAuthStore((s) => s.status)
  const hasPermission = useAuthStore((s) => (permission ? s.hasPermission(permission) : true))
  const location = useLocation()

  if (status === 'idle' || status === 'loading') {
    return <LoadingScreen />
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!hasPermission) {
    return <Navigate to="/forbidden" replace />
  }

  return <Outlet />
}
