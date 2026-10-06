export interface BookingReportSummary {
  total: number
  completed: number
  cancelled: number
  totalFare: number
}

export interface BookingReportRow {
  bookingCode: string
  mode: string
  categoryKey: string
  customerName: string
  driverName: string
  status: string
  fareTotal: number
  createdAt: string
}

export interface BookingReport {
  summary: BookingReportSummary
  rows: BookingReportRow[]
}

export interface RevenueReportSummary {
  grossRevenue: number
  platformCommission: number
  refunds: number
  netRevenue: number
}

export interface RevenueReportDay {
  date: string
  revenue: number
}

export interface RevenueReport {
  summary: RevenueReportSummary
  byDay: RevenueReportDay[]
}

export interface RiderReportRow {
  driverName: string
  serviceType: string
  totalTrips: number
  completedInRange: number
  cancelledInRange: number
  earnings: number
  rating: number
}

export interface RiderReport {
  rows: RiderReportRow[]
}

export interface PartnerReportRow {
  companyName: string
  vehicleCount: number
  driverCount: number
  deliveriesInRange: number
  revenueInRange: number
  status: string
}

export interface PartnerReport {
  rows: PartnerReportRow[]
}

export interface FinancialReportSummary {
  grossRevenue: number
  refunds: number
  netRevenue: number
  walletCreditsTotal: number
  walletDebitsTotal: number
}

export interface FinancialReportRow {
  date: string
  paymentsCount: number
  paymentsAmount: number
  refundsCount: number
  refundsAmount: number
}

export interface FinancialReport {
  summary: FinancialReportSummary
  rows: FinancialReportRow[]
}
