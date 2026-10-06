import type { Types } from 'mongoose'
import { Coupon } from '../models/Coupon'
import { Booking } from '../models/Booking'
import { HttpError, roundMoney } from './http'

interface CouponCheck {
  code: string
  customerId: Types.ObjectId | string
  mode: 'ride' | 'transport'
  categoryKey: string
  serviceAreaId?: Types.ObjectId | null
  fareTotal: number
}

/** Validates a coupon for a fare; throws 400 with the reason when it cannot be used. */
export async function applyCoupon(input: CouponCheck) {
  const code = input.code.trim().toUpperCase()
  const now = new Date()
  const coupon = await Coupon.findOne({ code, status: 'active' })
  if (!coupon || coupon.validFrom > now || coupon.validTo < now) throw new HttpError(400, 'This coupon is invalid or has expired')

  if (coupon.applicableMode !== 'both' && coupon.applicableMode !== input.mode) {
    throw new HttpError(400, `This coupon is only valid on ${coupon.applicableMode} bookings`)
  }
  if (coupon.applicableCategories.length && !coupon.applicableCategories.includes(input.categoryKey)) {
    throw new HttpError(400, 'This coupon is not valid for the selected vehicle')
  }
  if (coupon.serviceAreas.length && !coupon.serviceAreas.some((id) => input.serviceAreaId && id.equals(input.serviceAreaId))) {
    throw new HttpError(400, 'This coupon is not valid in your city')
  }
  if (input.fareTotal < (coupon.minBookingAmount ?? 0)) {
    throw new HttpError(400, `Minimum booking amount for this coupon is ₹${coupon.minBookingAmount}`)
  }
  if (coupon.usageLimitTotal != null && coupon.usedCount >= coupon.usageLimitTotal) {
    throw new HttpError(400, 'This coupon has reached its usage limit')
  }
  if (coupon.usageLimitPerUser != null) {
    const used = await Booking.countDocuments({ customer: input.customerId, couponCode: code, status: { $ne: 'cancelled' } })
    if (used >= coupon.usageLimitPerUser) throw new HttpError(400, 'You have already used this coupon')
  }

  let discount = coupon.discountType === 'flat' ? coupon.amount : (input.fareTotal * coupon.amount) / 100
  if (coupon.maxDiscount != null) discount = Math.min(discount, coupon.maxDiscount)
  discount = Math.round(Math.min(discount, input.fareTotal))

  return { coupon, code, discount: roundMoney(discount) }
}
