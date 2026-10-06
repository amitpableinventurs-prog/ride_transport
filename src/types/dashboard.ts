export interface DashboardStats {
  totals: {
    customers: number
    riders: number
    drivers: number
    transportPartners: number
    vehicles: number
  }
  today: {
    bookings: number
    ongoingRides: number
    activeDeliveries: number
    completed: number
    cancelled: number
  }
  revenue: {
    todayRevenue: number
    platformCommission: number
    partnerEarnings: number
    refunds: number
  }
  serviceSplit: { label: 'Ride' | 'Transport'; value: number }[]
  bookingStatusDistribution: { label: string; value: number; color: string }[]
  revenueTrend: { day: string; revenue: number }[]
  recentBookings: {
    id: string
    customer: string
    mode: 'Ride' | 'Transport'
    category: string
    status: string
    fare: number
    createdAt: string
  }[]
  pendingApprovals: {
    id: string
    type: 'Rider' | 'Driver' | 'Transport Partner'
    name: string
    submittedAt: string
  }[]
  alerts: {
    id: string
    type: 'document' | 'sos' | 'payment' | 'operational'
    message: string
    severity: 'high' | 'medium' | 'low'
    createdAt: string
  }[]
}
