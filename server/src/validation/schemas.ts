// zod schemas for admin endpoints that move money, change permissions or sign people in.
// z.object() drops unknown fields, which is what stops a client from setting fields it should not.
import { z } from 'zod'
import { ROLE_KEYS } from '../types/rbac'

const text = (max: number) => z.string().trim().min(1).max(max)
const money = (max = 1_000_000) => z.number().finite().min(0).max(max)
const percent = z.number().finite().min(0).max(100)
const status = z.enum(['active', 'inactive'])
const date = z.coerce.date()
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'must be a valid id')

export const idParams = z.object({ id: objectId })

// ---------- Admin sign-in ----------

export const adminLoginBody = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(200),
})
export const adminVerifyOtpBody = z.object({ otpToken: z.string().min(10).max(2000), otp: z.string().regex(/^\d{6}$/, 'must be 6 digits') })
export const adminResendOtpBody = z.object({ otpToken: z.string().min(10).max(2000) })
export const refreshBody = z.object({ refreshToken: z.string().min(10).max(2000) })

// ---------- Admin users ----------

const phone = z.string().trim().regex(/^\+?[\d\s-]{8,16}$/, 'must be a valid phone number')
export const createAdminBody = z.object({
  name: text(100),
  email: z.string().trim().toLowerCase().email().max(254),
  phone,
  role: z.enum(ROLE_KEYS),
})
export const updateAdminBody = z
  .object({ name: text(100), phone, role: z.enum(ROLE_KEYS), status: z.enum(['active', 'suspended']) })
  .partial()

// ---------- Pricing ----------

const pricingFields = {
  mode: z.enum(['ride', 'transport']),
  categoryKey: text(60),
  serviceArea: objectId.nullable(),
  baseFare: money(),
  perKm: money(10_000),
  perMinute: money(10_000),
  minimumFare: money(),
  waitingChargePerMin: money(10_000),
  nightChargeMultiplier: z.number().finite().min(1).max(5),
  platformFeeFlat: money(),
  platformFeePercent: percent,
  cancellationFee: money(),
  loadingUnloadingCharge: money(),
  additionalStopCharge: money(),
  taxPercent: percent,
  effectiveFrom: date,
  status,
}
export const createPricingBody = z.object(pricingFields).partial().required({ mode: true, categoryKey: true, baseFare: true, perKm: true, minimumFare: true })
export const updatePricingBody = z.object(pricingFields).partial()

// ---------- Commissions ----------

const commissionFields = {
  appliesTo: z.enum(['driver', 'partner']),
  categoryKey: text(60).nullable(),
  type: z.enum(['percentage', 'fixed']),
  value: money(),
  effectiveFrom: date,
  status,
}
const commissionRules = (v: { type?: string; value?: number }) => !(v.type === 'percentage' && v.value !== undefined && v.value > 100)
const commissionRuleMessage = { message: 'a percentage commission cannot be more than 100', path: ['value'] }
export const createCommissionBody = z
  .object(commissionFields)
  .partial()
  .required({ appliesTo: true, type: true, value: true })
  .refine(commissionRules, commissionRuleMessage)
export const updateCommissionBody = z.object(commissionFields).partial().refine(commissionRules, commissionRuleMessage)

// ---------- Wallets ----------

export const adjustWalletBody = z.object({
  type: z.enum(['credit', 'debit']),
  amount: z.number().finite().positive().max(100_000),
  reason: z.string().max(40).optional(),
})
