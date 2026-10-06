export type RoleKey =
  | 'super_admin'
  | 'operations_admin'
  | 'finance_admin'
  | 'support_admin'
  | 'content_admin'

export type PermissionKey =
  | 'dashboard.view'
  | 'admins.view'
  | 'admins.manage'
  | 'roles.view'
  | 'roles.manage'
  | 'audit_logs.view'
  | 'settings.view'
  | 'settings.manage'
  | 'bookings.view'
  | 'bookings.manage'
  | 'users.view'
  | 'users.manage'
  | 'fleet.view'
  | 'fleet.manage'
  | 'finance.view'
  | 'finance.manage'
  | 'pricing.view'
  | 'pricing.manage'
  | 'marketing.view'
  | 'marketing.manage'
  | 'support.view'
  | 'support.manage'
  | 'reports.view'

export interface Role {
  key: RoleKey
  name: string
  description: string
  permissions: PermissionKey[]
  isSystem: boolean
}

export interface AdminUser {
  id: string
  name: string
  email: string
  phone: string
  role: RoleKey
  status: 'active' | 'suspended'
  avatarColor: string
  lastLoginAt: string | null
  createdAt: string
}

export const PERMISSION_GROUPS: { label: string; permissions: { key: PermissionKey; label: string }[] }[] = [
  {
    label: 'Dashboard',
    permissions: [{ key: 'dashboard.view', label: 'View dashboard' }],
  },
  {
    label: 'System / Admin Users',
    permissions: [
      { key: 'admins.view', label: 'View admin users' },
      { key: 'admins.manage', label: 'Create / edit / block admin users' },
      { key: 'roles.view', label: 'View roles & permissions' },
      { key: 'roles.manage', label: 'Edit roles & permissions' },
      { key: 'audit_logs.view', label: 'View audit logs' },
      { key: 'settings.view', label: 'View system settings' },
      { key: 'settings.manage', label: 'Edit system settings' },
    ],
  },
  {
    label: 'Operations / Bookings',
    permissions: [
      { key: 'bookings.view', label: 'View bookings & live tracking' },
      { key: 'bookings.manage', label: 'Assign / reassign / cancel bookings' },
    ],
  },
  {
    label: 'Users (Customers / Riders / Partners)',
    permissions: [
      { key: 'users.view', label: 'View customers, riders, partners' },
      { key: 'users.manage', label: 'Approve / suspend / block accounts' },
    ],
  },
  {
    label: 'Fleet',
    permissions: [
      { key: 'fleet.view', label: 'View vehicles & documents' },
      { key: 'fleet.manage', label: 'Manage vehicles & documents' },
    ],
  },
  {
    label: 'Finance',
    permissions: [
      { key: 'finance.view', label: 'View payments, wallets, transactions' },
      { key: 'finance.manage', label: 'Process refunds & wallet adjustments' },
    ],
  },
  {
    label: 'Pricing',
    permissions: [
      { key: 'pricing.view', label: 'View pricing & commission rules' },
      { key: 'pricing.manage', label: 'Edit pricing & commission rules' },
    ],
  },
  {
    label: 'Marketing',
    permissions: [
      { key: 'marketing.view', label: 'View coupons, offers, banners' },
      { key: 'marketing.manage', label: 'Manage coupons, offers, banners' },
    ],
  },
  {
    label: 'Support',
    permissions: [
      { key: 'support.view', label: 'View complaints, tickets, ratings' },
      { key: 'support.manage', label: 'Resolve tickets & complaints' },
    ],
  },
  {
    label: 'Reports',
    permissions: [{ key: 'reports.view', label: 'View & export reports' }],
  },
]
