import type { LucideIcon } from 'lucide-react'
import {
  LayoutDashboard,
  LayoutGrid,
  Map,
  MapPinned,
  Car,
  Truck,
  Siren,
  Users,
  Bike,
  UserCog,
  Building2,
  CarFront,
  ListChecks,
  FileStack,
  ArrowLeftRight,
  Percent,
  RotateCcw,
  Landmark,
  Tags,
  Gauge,
  BadgePercent,
  Ban,
  Ticket,
  Image,
  Bell,
  MessageSquareWarning,
  LifeBuoy,
  Star,
  Shield,
  KeyRound,
  FileText,
  Settings,
  ScrollText,
  Radar,
  CreditCard,
  PiggyBank,
  Shapes,
  Package,
  Headset,
  Megaphone,
  IndianRupee,
  ChartColumn,
  ChartPie,
  TrendingUp,
  Handshake,
  Receipt,
  Cog,
  UserRound,
} from 'lucide-react'
import type { PermissionKey } from '@/types/rbac'

export interface NavItem {
  label: string
  path: string
  icon: LucideIcon
  permission?: PermissionKey
}

export type NavAccent = 'orange' | 'sky' | 'emerald' | 'amber' | 'violet' | 'pink' | 'cyan' | 'indigo' | 'slate'

export interface NavGroup {
  label: string
  icon: LucideIcon
  accent: NavAccent
  items: NavItem[]
}

export const dashboardNavItem: NavItem = {
  label: 'Dashboard',
  path: '/dashboard',
  icon: LayoutDashboard,
  permission: 'dashboard.view',
}

export const navGroups: NavGroup[] = [
  {
    label: 'Operations',
    icon: Radar,
    accent: 'orange',
    items: [
      { label: 'Bookings', path: '/operations/bookings', icon: ListChecks, permission: 'bookings.view' },
      { label: 'Categories', path: '/operations/categories', icon: LayoutGrid, permission: 'bookings.view' },
      { label: 'Live Tracking', path: '/operations/live-tracking', icon: MapPinned, permission: 'bookings.view' },
      { label: 'Active Rides', path: '/operations/active-rides', icon: Car, permission: 'bookings.view' },
      { label: 'Deliveries', path: '/operations/deliveries', icon: Truck, permission: 'bookings.view' },
      { label: 'SOS', path: '/operations/sos', icon: Siren, permission: 'bookings.view' },
    ],
  },
  {
    label: 'Users',
    icon: Users,
    accent: 'sky',
    items: [
      { label: 'Customers', path: '/users/customers', icon: Users, permission: 'users.view' },
      { label: 'Riders', path: '/users/riders', icon: Bike, permission: 'users.view' },
      { label: 'Drivers', path: '/users/drivers', icon: UserCog, permission: 'users.view' },
      { label: 'Transport Partners', path: '/users/partners', icon: Building2, permission: 'users.view' },
    ],
  },
  {
    label: 'Fleet',
    icon: Car,
    accent: 'emerald',
    items: [
      { label: 'Vehicles', path: '/fleet/vehicles', icon: CarFront, permission: 'fleet.view' },
      { label: 'Vehicle Types', path: '/fleet/vehicle-types', icon: Shapes, permission: 'fleet.view' },
      { label: 'Documents', path: '/fleet/documents', icon: FileStack, permission: 'fleet.view' },
    ],
  },
  {
    label: 'Finance',
    icon: IndianRupee,
    accent: 'amber',
    items: [
      { label: 'Payments', path: '/finance/payments', icon: CreditCard, permission: 'finance.view' },
      { label: 'Transactions', path: '/finance/transactions', icon: ArrowLeftRight, permission: 'finance.view' },
      { label: 'Wallets', path: '/finance/wallets', icon: PiggyBank, permission: 'finance.view' },
      { label: 'Commissions', path: '/finance/commissions', icon: Percent, permission: 'finance.view' },
      { label: 'Refunds', path: '/finance/refunds', icon: RotateCcw, permission: 'finance.view' },
      { label: 'Settlements', path: '/finance/settlements', icon: Landmark, permission: 'finance.view' },
    ],
  },
  {
    label: 'Pricing',
    icon: Tags,
    accent: 'violet',
    items: [
      { label: 'Ride Pricing', path: '/pricing/ride', icon: Tags, permission: 'pricing.view' },
      { label: 'Transport Pricing', path: '/pricing/transport', icon: Package, permission: 'pricing.view' },
      { label: 'Surge Pricing', path: '/pricing/surge', icon: Gauge, permission: 'pricing.view' },
      { label: 'Cancellation Charges', path: '/pricing/cancellation-charges', icon: Ban, permission: 'pricing.view' },
    ],
  },
  {
    label: 'Marketing',
    icon: Megaphone,
    accent: 'pink',
    items: [
      { label: 'Coupons', path: '/marketing/coupons', icon: BadgePercent, permission: 'marketing.view' },
      { label: 'Offers', path: '/marketing/offers', icon: Ticket, permission: 'marketing.view' },
      { label: 'Banners', path: '/marketing/banners', icon: Image, permission: 'marketing.view' },
      { label: 'Notifications', path: '/marketing/notifications', icon: Bell, permission: 'marketing.view' },
    ],
  },
  {
    label: 'Support',
    icon: Headset,
    accent: 'cyan',
    items: [
      { label: 'Complaints', path: '/support/complaints', icon: MessageSquareWarning, permission: 'support.view' },
      { label: 'Tickets', path: '/support/tickets', icon: LifeBuoy, permission: 'support.view' },
      { label: 'Ratings', path: '/support/ratings', icon: Star, permission: 'support.view' },
    ],
  },
  {
    label: 'Reports',
    icon: ChartColumn,
    accent: 'indigo',
    items: [
      { label: 'Booking Report', path: '/reports/booking', icon: Receipt, permission: 'reports.view' },
      { label: 'Revenue Report', path: '/reports/revenue', icon: TrendingUp, permission: 'reports.view' },
      { label: 'Rider Report', path: '/reports/rider', icon: UserRound, permission: 'reports.view' },
      { label: 'Partner Report', path: '/reports/partner', icon: Handshake, permission: 'reports.view' },
      { label: 'Financial Report', path: '/reports/financial', icon: ChartPie, permission: 'reports.view' },
    ],
  },
  {
    label: 'System',
    icon: Cog,
    accent: 'slate',
    items: [
      { label: 'Admin Users', path: '/system/admin-users', icon: Shield, permission: 'admins.view' },
      { label: 'Roles & Permissions', path: '/system/roles-permissions', icon: KeyRound, permission: 'roles.view' },
      { label: 'CMS', path: '/system/cms', icon: FileText, permission: 'marketing.view' },
      { label: 'Service Areas', path: '/system/service-areas', icon: Map, permission: 'settings.view' },
      { label: 'Settings', path: '/system/settings', icon: Settings, permission: 'settings.view' },
      { label: 'Audit Logs', path: '/system/audit-logs', icon: ScrollText, permission: 'audit_logs.view' },
    ],
  },
]
