import { useEffect, type ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { LoginPage } from '@/pages/auth/LoginPage'
import { DashboardPage } from '@/pages/dashboard/DashboardPage'
import { BookingsPage } from '@/pages/operations/BookingsPage'
import { CategoriesPage } from '@/pages/operations/CategoriesPage'
import { LiveTrackingPage } from '@/pages/operations/LiveTrackingPage'
import { ActiveRidesPage } from '@/pages/operations/ActiveRidesPage'
import { DeliveriesPage } from '@/pages/operations/DeliveriesPage'
import { SosPage } from '@/pages/operations/SosPage'
import { CustomersPage } from '@/pages/users/CustomersPage'
import { RidersPage } from '@/pages/users/RidersPage'
import { DriversPage } from '@/pages/users/DriversPage'
import { TransportPartnersPage } from '@/pages/users/TransportPartnersPage'
import { VehiclesPage } from '@/pages/fleet/VehiclesPage'
import { VehicleTypesPage } from '@/pages/fleet/VehicleTypesPage'
import { DocumentsPage } from '@/pages/fleet/DocumentsPage'
import { PaymentsPage } from '@/pages/finance/PaymentsPage'
import { TransactionsPage } from '@/pages/finance/TransactionsPage'
import { WalletsPage } from '@/pages/finance/WalletsPage'
import { CommissionsPage } from '@/pages/finance/CommissionsPage'
import { RefundsPage } from '@/pages/finance/RefundsPage'
import { SettlementsPage } from '@/pages/finance/SettlementsPage'
import { RidePricingPage } from '@/pages/pricing/RidePricingPage'
import { TransportPricingPage } from '@/pages/pricing/TransportPricingPage'
import { SurgePricingPage } from '@/pages/pricing/SurgePricingPage'
import { CancellationChargesPage } from '@/pages/pricing/CancellationChargesPage'
import { CouponsPage } from '@/pages/marketing/CouponsPage'
import { OffersPage } from '@/pages/marketing/OffersPage'
import { BannersPage } from '@/pages/marketing/BannersPage'
import { NotificationsPage } from '@/pages/marketing/NotificationsPage'
import { ComplaintsPage } from '@/pages/support/ComplaintsPage'
import { TicketsPage } from '@/pages/support/TicketsPage'
import { RatingsPage } from '@/pages/support/RatingsPage'
import { BookingReportPage } from '@/pages/reports/BookingReportPage'
import { RevenueReportPage } from '@/pages/reports/RevenueReportPage'
import { RiderReportPage } from '@/pages/reports/RiderReportPage'
import { PartnerReportPage } from '@/pages/reports/PartnerReportPage'
import { FinancialReportPage } from '@/pages/reports/FinancialReportPage'
import { AdminUsersPage } from '@/pages/system/AdminUsersPage'
import { RolesPermissionsPage } from '@/pages/system/RolesPermissionsPage'
import { CmsPagesPage } from '@/pages/system/CmsPagesPage'
import { ServiceAreasPage } from '@/pages/system/ServiceAreasPage'
import { SettingsPage } from '@/pages/system/SettingsPage'
import { AuditLogsPage } from '@/pages/system/AuditLogsPage'
import { ForbiddenPage } from '@/pages/misc/ForbiddenPage'
import { NotFoundPage } from '@/pages/misc/NotFoundPage'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { dashboardNavItem, navGroups } from '@/lib/navigation'

// Page for each sidebar path. Routes (and their permission checks) are generated
// from the sidebar config in lib/navigation.ts, so a new nav item only needs an entry here.
const PAGES: Record<string, ComponentType> = {
  '/operations/bookings': BookingsPage,
  '/operations/categories': CategoriesPage,
  '/operations/live-tracking': LiveTrackingPage,
  '/operations/active-rides': ActiveRidesPage,
  '/operations/deliveries': DeliveriesPage,
  '/operations/sos': SosPage,
  '/users/customers': CustomersPage,
  '/users/riders': RidersPage,
  '/users/drivers': DriversPage,
  '/users/partners': TransportPartnersPage,
  '/fleet/vehicles': VehiclesPage,
  '/fleet/vehicle-types': VehicleTypesPage,
  '/fleet/documents': DocumentsPage,
  '/finance/payments': PaymentsPage,
  '/finance/transactions': TransactionsPage,
  '/finance/wallets': WalletsPage,
  '/finance/commissions': CommissionsPage,
  '/finance/refunds': RefundsPage,
  '/finance/settlements': SettlementsPage,
  '/pricing/ride': RidePricingPage,
  '/pricing/transport': TransportPricingPage,
  '/pricing/surge': SurgePricingPage,
  '/pricing/cancellation-charges': CancellationChargesPage,
  '/marketing/coupons': CouponsPage,
  '/marketing/offers': OffersPage,
  '/marketing/banners': BannersPage,
  '/marketing/notifications': NotificationsPage,
  '/support/complaints': ComplaintsPage,
  '/support/tickets': TicketsPage,
  '/support/ratings': RatingsPage,
  '/reports/booking': BookingReportPage,
  '/reports/revenue': RevenueReportPage,
  '/reports/rider': RiderReportPage,
  '/reports/partner': PartnerReportPage,
  '/reports/financial': FinancialReportPage,
  '/system/admin-users': AdminUsersPage,
  '/system/roles-permissions': RolesPermissionsPage,
  '/system/cms': CmsPagesPage,
  '/system/service-areas': ServiceAreasPage,
  '/system/settings': SettingsPage,
  '/system/audit-logs': AuditLogsPage,
}

function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap)

  useEffect(() => {
    bootstrap()
  }, [bootstrap])

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />

          <Route element={<ProtectedRoute permission={dashboardNavItem.permission} />}>
            <Route path="/dashboard" element={<DashboardPage />} />
          </Route>

          {navGroups
            .flatMap((group) => group.items)
            .map((item) => {
              const Page = PAGES[item.path] ?? NotFoundPage
              return (
                <Route key={item.path} element={<ProtectedRoute permission={item.permission} />}>
                  <Route path={item.path} element={<Page />} />
                </Route>
              )
            })}

          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default App
