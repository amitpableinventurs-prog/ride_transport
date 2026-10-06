import type { Request, Response } from 'express'
import type { FilterQuery } from 'mongoose'
import { Coupon, type CouponDocument } from '../models/Coupon'
import { recordAudit } from '../utils/audit'

const MUTABLE_FIELDS = [
  'code',
  'title',
  'autoApply',
  'discountType',
  'amount',
  'minBookingAmount',
  'maxDiscount',
  'validFrom',
  'validTo',
  'usageLimitTotal',
  'usageLimitPerUser',
  'applicableMode',
  'applicableCategories',
  'serviceAreas',
  'status',
] as const

function pickMutableFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const key of MUTABLE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key]
  }
  // An empty string code should be stored as undefined so the sparse unique index doesn't collide.
  if (out.code === '') out.code = undefined
  return out
}

export async function listCoupons(req: Request, res: Response) {
  const { autoApply, status, q } = req.query as { autoApply?: string; status?: string; q?: string }
  const filter: FilterQuery<CouponDocument> = {}
  if (autoApply === 'true') filter.autoApply = true
  if (autoApply === 'false') filter.autoApply = false
  if (status) filter.status = status as CouponDocument['status']
  if (q) {
    filter.$or = [{ title: { $regex: q.trim(), $options: 'i' } }, { code: { $regex: q.trim(), $options: 'i' } }]
  }
  const coupons = await Coupon.find(filter).sort({ createdAt: -1 })
  res.json(coupons)
}

export async function getCoupon(req: Request, res: Response) {
  const coupon = await Coupon.findById(req.params.id)
  if (!coupon) {
    res.status(404).json({ message: 'Coupon not found' })
    return
  }
  res.json(coupon)
}

export async function createCoupon(req: Request, res: Response) {
  const body = req.body as Record<string, unknown>
  if (!body.title || !body.discountType || body.amount === undefined || !body.validFrom || !body.validTo) {
    res.status(400).json({ message: 'title, discountType, amount, validFrom and validTo are required' })
    return
  }

  const coupon = await Coupon.create(pickMutableFields(body))
  await recordAudit(req.admin!, coupon.autoApply ? 'offer.create' : 'coupon.create', coupon.autoApply ? 'Offer' : 'Coupon', coupon.title)
  res.status(201).json(coupon)
}

export async function updateCoupon(req: Request, res: Response) {
  const coupon = await Coupon.findById(req.params.id)
  if (!coupon) {
    res.status(404).json({ message: 'Coupon not found' })
    return
  }

  const patch = pickMutableFields(req.body as Record<string, unknown>)
  Object.assign(coupon, patch)
  await coupon.save()

  await recordAudit(
    req.admin!,
    coupon.autoApply ? 'offer.updated' : 'coupon.updated',
    coupon.autoApply ? 'Offer' : 'Coupon',
    coupon.title,
    patch.status !== undefined ? { status: patch.status } : undefined,
  )
  res.json(coupon)
}

export async function deleteCoupon(req: Request, res: Response) {
  const coupon = await Coupon.findById(req.params.id)
  if (!coupon) {
    res.status(404).json({ message: 'Coupon not found' })
    return
  }
  await coupon.deleteOne()
  await recordAudit(req.admin!, coupon.autoApply ? 'offer.deleted' : 'coupon.deleted', coupon.autoApply ? 'Offer' : 'Coupon', coupon.title)
  res.status(204).end()
}
