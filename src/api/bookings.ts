import { apiClient } from './client'
import type { AvailableDriver, Booking, BookingListResponse, BookingStatus, ServiceMode } from '@/types/booking'

export interface BookingListParams {
  mode?: ServiceMode
  status?: string
  paymentStatus?: string
  q?: string
  page?: number
  limit?: number
}

export async function fetchBookings(params: BookingListParams = {}): Promise<BookingListResponse> {
  const { data } = await apiClient.get<BookingListResponse>('/bookings', { params })
  return data
}

export async function fetchBooking(id: string): Promise<Booking> {
  const { data } = await apiClient.get<Booking>(`/bookings/${id}`)
  return data
}

export async function fetchAvailableDrivers(mode?: ServiceMode, categoryKey?: string): Promise<AvailableDriver[]> {
  const { data } = await apiClient.get<AvailableDriver[]>('/bookings/available-drivers', { params: { mode, categoryKey } })
  return data
}

export async function assignBookingDriver(id: string, input: { driverId: string; vehicleId?: string }): Promise<Booking> {
  const { data } = await apiClient.patch<Booking>(`/bookings/${id}/assign`, input)
  return data
}

export async function updateBookingStatus(
  id: string,
  input: { status: BookingStatus; note?: string; cancelledBy?: 'customer' | 'driver' | 'admin'; reason?: string },
): Promise<Booking> {
  const { data } = await apiClient.patch<Booking>(`/bookings/${id}/status`, input)
  return data
}
