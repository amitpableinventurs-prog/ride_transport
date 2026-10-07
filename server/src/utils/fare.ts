import type { HydratedDocument, Types } from 'mongoose'
import { PricingRule, type PricingRuleDocument } from '../models/PricingRule'
import { CommissionRule, type CommissionRuleDocument } from '../models/CommissionRule'
import { TtlCache } from './cache'
import { roundMoney } from './http'

// Pricing and commission rules are read for every fare estimate and trip but change only when an admin edits them.
// Cached for 10 seconds (and cleared at once after an admin change, see clearFareCaches).
type PricingRuleDoc = HydratedDocument<PricingRuleDocument> | null
const ruleCache = new TtlCache<PricingRuleDoc>(10_000, 500)
const commissionCache = new TtlCache<CommissionRuleDoc[]>(10_000, 100)
type CommissionRuleDoc = HydratedDocument<CommissionRuleDocument>

export function clearFareCaches() {
  ruleCache.clear()
  commissionCache.clear()
}

export interface FareBreakdown {
  base: number
  distance: number
  time: number
  waiting: number
  night: number
  extraStops: number
  loading: number
  platformFee: number
  tax: number
  discount: number
  tip: number
  total: number
}

export interface FareInput {
  distanceKm: number
  durationMin: number
  /** Drops beyond the first (transport multi-drop). */
  extraStops?: number
  needsLoading?: boolean
  waitingMin?: number
  discount?: number
  at?: Date
}

const NIGHT_START_HOUR = 22
const NIGHT_END_HOUR = 6

/** The city-specific pricing rule for a category, falling back to the global (no service area) rule. */
export function findPricingRule(categoryKey: string, serviceAreaId?: Types.ObjectId | null) {
  return ruleCache.get(`${categoryKey}:${serviceAreaId ?? 'global'}`, () => loadPricingRule(categoryKey, serviceAreaId))
}

async function loadPricingRule(categoryKey: string, serviceAreaId?: Types.ObjectId | null) {
  const base = { categoryKey, status: 'active', effectiveFrom: { $lte: new Date() } }
  if (serviceAreaId) {
    const local = await PricingRule.findOne({ ...base, serviceArea: serviceAreaId }).sort({ effectiveFrom: -1 })
    if (local) return local
  }
  return PricingRule.findOne({ ...base, serviceArea: null }).sort({ effectiveFrom: -1 })
}

function isNight(at: Date): boolean {
  // Pricing follows Indian local time regardless of the server's timezone.
  // India has no daylight saving: local time is always UTC+5:30 (this avoids a slow Intl formatter on every fare).
  const hour = Math.floor(((at.getUTCHours() * 60 + at.getUTCMinutes() + 330) % 1440) / 60)
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR
}

export function computeFare(rule: PricingRuleDocument, input: FareInput): FareBreakdown {
  const distance = rule.perKm * input.distanceKm
  const time = (rule.perMinute ?? 0) * input.durationMin
  const waiting = (rule.waitingChargePerMin ?? 0) * (input.waitingMin ?? 0)
  const multiplier = rule.nightChargeMultiplier ?? 1
  const night = isNight(input.at ?? new Date()) && multiplier > 1 ? (rule.baseFare + distance + time) * (multiplier - 1) : 0
  const extraStops = (rule.additionalStopCharge ?? 0) * (input.extraStops ?? 0)
  const loading = input.needsLoading ? rule.loadingUnloadingCharge ?? 0 : 0

  let base = rule.baseFare
  const rideFare = base + distance + time + waiting + night
  // Bring short trips up to the minimum fare by raising the base component.
  if (rideFare < rule.minimumFare) base += rule.minimumFare - rideFare

  const subtotal = base + distance + time + waiting + night + extraStops + loading
  const platformFee = (rule.platformFeeFlat ?? 0) + (subtotal * (rule.platformFeePercent ?? 0)) / 100
  const tax = ((subtotal + platformFee) * (rule.taxPercent ?? 0)) / 100
  const gross = Math.round(subtotal + platformFee + tax)
  const discount = Math.min(gross, Math.round(input.discount ?? 0))

  return {
    base: roundMoney(base),
    distance: roundMoney(distance),
    time: roundMoney(time),
    waiting: roundMoney(waiting),
    night: roundMoney(night),
    extraStops: roundMoney(extraStops),
    loading: roundMoney(loading),
    platformFee: roundMoney(platformFee),
    tax: roundMoney(tax),
    discount,
    tip: 0,
    total: gross - discount,
  }
}

/** Platform commission on a completed trip, from the most specific active rule. */
export async function computeCommission(categoryKey: string, fareTotal: number): Promise<number> {
  const rules = await commissionCache.get(categoryKey, () =>
    CommissionRule.find({
      appliesTo: 'driver',
      status: 'active',
      effectiveFrom: { $lte: new Date() },
      $or: [{ categoryKey }, { categoryKey: null }, { categoryKey: { $exists: false } }],
    }).sort({ effectiveFrom: -1 }),
  )
  const rule = rules.find((r) => r.categoryKey === categoryKey) ?? rules[0]
  if (!rule) return 0
  const commission = rule.type === 'percentage' ? (fareTotal * rule.value) / 100 : rule.value
  return roundMoney(Math.min(fareTotal, Math.max(0, commission)))
}
