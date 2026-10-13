import { apiClient } from './client'
import type { PaginatedResult, Refund, RefundBookingInfo } from '@/types/finance'

export async function fetchRefunds(params?: { status?: string; page?: number; limit?: number }): Promise<PaginatedResult<Refund>> {
  const { data } = await apiClient.get<PaginatedResult<Refund>>('/refunds', { params })
  return data
}

export async function approveRefund(id: string): Promise<Refund> {
  const { data } = await apiClient.patch<Refund>(`/refunds/${id}/approve`)
  return data
}

export async function rejectRefund(id: string, reason?: string): Promise<Refund> {
  const { data } = await apiClient.patch<Refund>(`/refunds/${id}/reject`, { reason })
  return data
}

export async function processRefund(id: string): Promise<Refund> {
  const { data } = await apiClient.patch<Refund>(`/refunds/${id}/process`)
  return data
}

export async function fetchRefundBookingInfo(bookingCode: string): Promise<RefundBookingInfo> {
  const { data } = await apiClient.get<RefundBookingInfo>('/refunds/booking-info', { params: { bookingCode } })
  return data
}

export async function createRefund(payload: { bookingCode: string; amount: number; reason: string }): Promise<Refund> {
  const { data } = await apiClient.post<Refund>('/refunds', payload)
  return data
}
