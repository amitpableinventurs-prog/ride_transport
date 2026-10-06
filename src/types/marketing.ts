export type DiscountType = 'flat' | 'percentage'
export type ServiceMode = 'ride' | 'transport' | 'both'
export type ActiveStatus = 'active' | 'inactive'

export interface Coupon {
  id: string
  code?: string | null
  title: string
  autoApply: boolean
  discountType: DiscountType
  amount: number
  minBookingAmount: number
  maxDiscount?: number | null
  validFrom: string
  validTo: string
  usageLimitTotal?: number | null
  usageLimitPerUser?: number | null
  usedCount: number
  applicableMode: ServiceMode
  applicableCategories: string[]
  serviceAreas: string[]
  status: ActiveStatus
  createdAt: string
  updatedAt: string
}

export interface ServiceArea {
  id: string
  name: string
  country: string
  state: string
  city: string
  zone?: string
  status: ActiveStatus
  rideEnabled: boolean
  transportEnabled: boolean
  geofence?: {
    centerLat?: number
    centerLng?: number
    radiusKm?: number
  }
  createdAt: string
  updatedAt: string
}

export interface Banner {
  id: string
  title: string
  description?: string
  imageUrl: string
  ctaLabel?: string
  targetLink?: string
  serviceMode: ServiceMode
  startDate: string
  endDate: string
  status: ActiveStatus
  createdAt: string
  updatedAt: string
}

export type CmsSlug = 'about' | 'contact' | 'terms' | 'privacy' | 'cancellation' | 'refund' | 'rider_terms' | 'partner_terms' | 'faq'

export interface CmsPage {
  id: string
  slug: CmsSlug
  title: string
  content: string
  updatedBy?: string | null
  createdAt: string
  updatedAt: string
}

export type NotificationChannel = 'push' | 'sms' | 'email'

export interface NotificationTemplate {
  id: string
  key: string
  channel: NotificationChannel
  title?: string
  body: string
  status: ActiveStatus
  createdAt: string
  updatedAt: string
}

export type BroadcastAudience = 'all_customers' | 'all_drivers' | 'all_partners' | 'custom'

export interface NotificationBroadcast {
  id: string
  template?: { id: string; key: string; channel: NotificationChannel } | string | null
  channel: NotificationChannel
  audience: BroadcastAudience
  serviceModeFilter: ServiceMode
  title: string
  body: string
  sentBy: string
  recipientCountEstimate: number
  createdAt: string
  updatedAt: string
}

export type TicketCategory = 'payment' | 'booking' | 'driver' | 'vehicle' | 'lost_item' | 'refund' | 'cancellation' | 'technical'
export type TicketStatus = 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high'
export type RaisedByType = 'customer' | 'driver' | 'partner'

export interface TicketNote {
  by: string
  text: string
  at: string
}

export interface Ticket {
  id: string
  subject: string
  category: TicketCategory
  raisedByType: RaisedByType
  raisedByName: string
  booking?: string | null
  status: TicketStatus
  assignedTo?: { id: string; name: string; email: string } | string | null
  priority: TicketPriority
  notes: TicketNote[]
  resolvedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type RatedBy = 'customer' | 'driver'

export interface Rating {
  id: string
  booking?: { id: string; bookingCode: string } | string | null
  customer?: { id: string; name: string } | string | null
  driver?: { id: string; name: string } | string | null
  ratedBy: RatedBy
  score: number
  comment?: string
  createdAt: string
  updatedAt: string
}
