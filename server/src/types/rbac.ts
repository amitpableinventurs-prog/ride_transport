export const ROLE_KEYS = ['super_admin', 'operations_admin', 'finance_admin', 'support_admin', 'content_admin'] as const
export type RoleKey = (typeof ROLE_KEYS)[number]

export const PERMISSION_KEYS = [
  'dashboard.view',
  'admins.view',
  'admins.manage',
  'roles.view',
  'roles.manage',
  'audit_logs.view',
  'settings.view',
  'settings.manage',
  'bookings.view',
  'bookings.manage',
  'users.view',
  'users.manage',
  'fleet.view',
  'fleet.manage',
  'finance.view',
  'finance.manage',
  'pricing.view',
  'pricing.manage',
  'marketing.view',
  'marketing.manage',
  'support.view',
  'support.manage',
  'reports.view',
] as const
export type PermissionKey = (typeof PERMISSION_KEYS)[number]
