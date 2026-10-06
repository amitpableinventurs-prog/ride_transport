export type PricingMode = 'ride' | 'transport'
export type RuleStatus = 'active' | 'inactive'

export interface PricingRule {
  id: string
  mode: PricingMode
  categoryKey: string
  serviceArea: string | null
  baseFare: number
  perKm: number
  perMinute: number
  minimumFare: number
  waitingChargePerMin: number
  nightChargeMultiplier: number
  platformFeeFlat: number
  platformFeePercent: number
  cancellationFee: number
  loadingUnloadingCharge: number
  additionalStopCharge: number
  taxPercent: number
  effectiveFrom: string
  status: RuleStatus
  createdAt: string
  updatedAt: string
}

export type CommissionAppliesTo = 'driver' | 'partner'
export type CommissionType = 'percentage' | 'fixed'

export interface CommissionRule {
  id: string
  appliesTo: CommissionAppliesTo
  categoryKey?: string
  type: CommissionType
  value: number
  effectiveFrom: string
  status: RuleStatus
  createdAt: string
  updatedAt: string
}

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'netbanking' | 'wallet'
export type PaymentGateway = 'razorpay' | 'stripe' | 'cash' | 'internal'
export type PaymentStatus = 'initiated' | 'success' | 'failed' | 'refunded'

export interface PaymentBookingRef {
  id: string
  bookingCode: string
  customer?: { id: string; name: string } | null
}

export interface Payment {
  id: string
  booking: PaymentBookingRef | null
  amount: number
  method: PaymentMethod
  gateway: PaymentGateway
  gatewayRefId?: string
  status: PaymentStatus
  createdAt: string
  updatedAt: string
}

export type WalletOwnerType = 'customer' | 'driver' | 'partner'

export interface Wallet {
  id: string
  ownerType: WalletOwnerType
  ownerId: string
  ownerName: string
  balance: number
  currency: string
  createdAt: string
  updatedAt: string
}

export type WalletTransactionType = 'credit' | 'debit'
export type WalletTransactionReason =
  | 'booking_earning'
  | 'booking_payment'
  | 'tip'
  | 'commission'
  | 'recharge'
  | 'refund'
  | 'penalty'
  | 'bonus'
  | 'withdrawal'
  | 'adjustment'

export interface WalletTransaction {
  id: string
  wallet: string
  type: WalletTransactionType
  amount: number
  reason: WalletTransactionReason
  referenceType?: string
  referenceId?: string
  balanceAfter: number
  createdBy?: string | null
  createdAt: string
}

export type RefundStatus = 'requested' | 'approved' | 'rejected' | 'processed'

export interface Refund {
  id: string
  booking: { id: string; bookingCode: string } | null
  payment?: string | null
  amount: number
  reason: string
  status: RefundStatus
  requestedBy?: string
  approvedBy?: string | null
  processedAt?: string | null
  createdAt: string
  updatedAt: string
}

export type SettlementPayeeType = 'driver' | 'partner'
export type SettlementStatus = 'pending' | 'processing' | 'paid'

export interface Settlement {
  id: string
  payeeType: SettlementPayeeType
  payeeId: string
  payeeName: string
  periodStart: string
  periodEnd: string
  grossEarnings: number
  commissionDeducted: number
  netPayable: number
  status: SettlementStatus
  paidAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface PaginatedResult<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
