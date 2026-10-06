export type UserStatus = 'active' | 'suspended' | 'blocked'
export type ApprovalStatus = 'pending' | 'verified' | 'rejected'

export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  status: UserStatus
  city?: string
  totalBookings: number
  rating: number
  createdAt: string
  updatedAt: string
}

export type ServiceType = 'rider' | 'driver'
export type OnlineStatus = 'offline' | 'online' | 'busy' | 'on_trip'

export interface Driver {
  id: string
  name: string
  email: string
  phone: string
  serviceType: ServiceType
  approvalStatus: ApprovalStatus
  status: UserStatus
  onlineStatus: OnlineStatus
  assignedVehicle?: string | null
  rating: number
  totalTrips: number
  cancellations: number
  earnings: number
  createdAt: string
  updatedAt: string
}

export interface TransportPartner {
  id: string
  companyName: string
  ownerName: string
  email: string
  phone: string
  businessRegNo?: string
  taxId?: string
  approvalStatus: ApprovalStatus
  status: UserStatus
  vehicleCount: number
  driverCount: number
  createdAt: string
  updatedAt: string
}

export type ServiceMode = 'ride' | 'transport'

export interface VehicleType {
  id: string
  name: string
  serviceMode: ServiceMode
  capacityLabel?: string
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface VehicleTypeRef {
  id: string
  name: string
  serviceMode: ServiceMode
  capacityLabel?: string
}

export type OwnerType = 'driver' | 'partner'

export interface Vehicle {
  id: string
  registrationNumber: string
  model: string
  manufacturer?: string
  vehicleType: VehicleTypeRef | string
  serviceMode: ServiceMode
  categoryKey: string
  ownerType: OwnerType
  ownerId: string
  ownerModel: 'Driver' | 'TransportPartner'
  ownerLabel?: string
  capacity?: string
  status: 'active' | 'inactive' | 'blocked'
  documentsStatus: 'pending' | 'verified' | 'rejected' | 'expired'
  createdAt: string
  updatedAt: string
}

export type DocumentOwnerType = 'driver' | 'partner' | 'vehicle'
export type DocumentStatus = 'pending' | 'verified' | 'rejected' | 'expired'

export interface DocumentRecord {
  id: string
  ownerType: DocumentOwnerType
  ownerId: string
  docType: string
  fileUrl: string
  status: DocumentStatus
  expiryDate?: string | null
  reviewedBy?: string | null
  reviewedAt?: string | null
  rejectionReason?: string | null
  createdAt: string
  updatedAt: string
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  limit: number
}
