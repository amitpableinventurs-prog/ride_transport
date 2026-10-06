import { apiClient } from './client'
import type { BookingReport, FinancialReport, PartnerReport, RevenueReport, RiderReport } from '@/types/reports'

export interface BookingReportFilters {
  mode?: string
  status?: string
}

export async function fetchBookingReport(from: string, to: string, extraFilters?: BookingReportFilters): Promise<BookingReport> {
  const { data } = await apiClient.get<BookingReport>('/reports/booking', {
    params: { from, to, ...extraFilters },
  })
  return data
}

export async function fetchRevenueReport(from: string, to: string): Promise<RevenueReport> {
  const { data } = await apiClient.get<RevenueReport>('/reports/revenue', { params: { from, to } })
  return data
}

export async function fetchRiderReport(from: string, to: string): Promise<RiderReport> {
  const { data } = await apiClient.get<RiderReport>('/reports/rider', { params: { from, to } })
  return data
}

export async function fetchPartnerReport(from: string, to: string): Promise<PartnerReport> {
  const { data } = await apiClient.get<PartnerReport>('/reports/partner', { params: { from, to } })
  return data
}

export async function fetchFinancialReport(from: string, to: string): Promise<FinancialReport> {
  const { data } = await apiClient.get<FinancialReport>('/reports/financial', { params: { from, to } })
  return data
}
