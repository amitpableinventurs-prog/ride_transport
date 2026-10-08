export type ServiceMode = 'ride' | 'transport'

export interface ServiceCategory {
  id: string
  mode: ServiceMode
  key: string
  name: string
  description?: string
  icon: string
  seats?: number
  capacityLabel?: string
  vehicleType?: string | { id: string; name: string; capacityLabel?: string } | null
  status: 'active' | 'inactive'
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export type BookingStatus =
  | 'scheduled'
  | 'requested'
  | 'no_rider_found'
  | 'accepted'
  | 'arriving'
  | 'arrived'
  | 'started'
  | 'in_transit'
  | 'completed'
  | 'cancelled'
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded'
export type PaymentMethod = 'cash' | 'upi' | 'card' | 'wallet' | 'netbanking'

export interface CustomerSummary {
  id: string
  name: string
  phone: string
  email?: string
}

export interface DriverSummary {
  id: string
  name: string
  phone: string
  rating?: number
  onlineStatus?: string
  currentLocation?: { lat?: number; lng?: number; updatedAt?: string }
}

export interface VehicleSummary {
  id: string
  registrationNumber: string
  model?: string
  capacity?: string
}

export interface PartnerSummary {
  id: string
  companyName: string
  ownerName: string
  phone: string
}

export interface BookingFare {
  base: number
  distance: number
  time: number
  waiting: number
  night: number
  platformFee: number
  tax: number
  discount: number
  extraStops?: number
  loading?: number
  tip?: number
  total: number
}

export interface BookingTimelineEntry {
  status: string
  at: string
  note?: string
}

export interface BookingGoodsDetails {
  description?: string
  weightKg?: number
  notes?: string
}

export interface BookingCancellation {
  by?: 'customer' | 'driver' | 'admin'
  reason?: string
  chargedAmount?: number
}

export interface Booking {
  id: string
  bookingCode: string
  mode: ServiceMode
  categoryKey: string
  customer: CustomerSummary | string | null
  driver: DriverSummary | string | null
  vehicle: VehicleSummary | string | null
  partner: PartnerSummary | string | null
  pickup: { address?: string; lat?: number; lng?: number }
  drop: { address?: string; lat?: number; lng?: number }
  goodsDetails?: BookingGoodsDetails
  status: BookingStatus
  fare: BookingFare
  distanceKm: number
  durationMin: number
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  cancellation?: BookingCancellation
  serviceArea?: string | null
  timeline: BookingTimelineEntry[]
  createdAt: string
  updatedAt: string
}

export interface BookingListResponse {
  items: Booking[]
  total: number
  page: number
  limit: number
}

export interface AvailableDriver {
  id: string
  name: string
  phone: string
  serviceType: 'rider' | 'transport'
  onlineStatus: string
  currentLocation?: { lat?: number; lng?: number; updatedAt?: string }
  rating?: number
}

export interface SosNote {
  by?: string
  text?: string
  at: string
}

export interface SosRequest {
  id: string
  booking?: { id: string; bookingCode: string; mode: string; status: string } | string | null
  raisedBy: 'customer' | 'driver'
  userName: string
  location: { lat?: number; lng?: number }
  status: 'open' | 'acknowledged' | 'resolved'
  notes: SosNote[]
  resolvedAt?: string | null
  createdAt: string
  updatedAt: string
}
