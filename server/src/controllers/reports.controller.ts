import type { Request, Response } from 'express'
import { Booking } from '../models/Booking'
import { Payment } from '../models/Payment'
import { Refund } from '../models/Refund'
import { Driver } from '../models/Driver'
import { TransportPartner } from '../models/TransportPartner'
import { WalletTransaction } from '../models/WalletTransaction'

const MS_PER_DAY = 24 * 60 * 60 * 1000

// All 5 report endpoints share the same ?from=&to= contract (ISO dates,
// defaulting to the last 30 days, filtering by createdAt). Date-only strings
// (no "T") are treated as inclusive of the whole day on the `to` side so a
// plain <input type="date"> range behaves the way an admin would expect.
function resolveRange(req: Request): { from: Date; to: Date } {
  const now = new Date()
  const defaultFrom = new Date(now.getTime() - 30 * MS_PER_DAY)

  const fromRaw = typeof req.query.from === 'string' ? req.query.from : undefined
  const toRaw = typeof req.query.to === 'string' ? req.query.to : undefined

  const fromParsed = fromRaw ? new Date(fromRaw) : null
  let toParsed = toRaw ? new Date(toRaw) : null
  if (toParsed && !Number.isNaN(toParsed.getTime()) && toRaw && !toRaw.includes('T')) {
    toParsed = new Date(toParsed.getTime() + MS_PER_DAY - 1)
  }

  const from = fromParsed && !Number.isNaN(fromParsed.getTime()) ? fromParsed : defaultFrom
  const to = toParsed && !Number.isNaN(toParsed.getTime()) ? toParsed : now

  return { from, to }
}

interface LeanBookingRow {
  bookingCode: string
  mode: string
  categoryKey: string
  status: string
  fare?: { total?: number }
  createdAt: Date
  customer?: { name?: string } | null
  driver?: { name?: string } | null
}

// GET /reports/booking?from=&to=&mode=&status=
export async function getBookingReport(req: Request, res: Response) {
  const { from, to } = resolveRange(req)
  const mode = typeof req.query.mode === 'string' ? req.query.mode : undefined
  const status = typeof req.query.status === 'string' ? req.query.status : undefined

  const match: Record<string, unknown> = { createdAt: { $gte: from, $lte: to } }
  if (mode) match.mode = mode
  if (status) match.status = status

  const [bookingDocs, summaryAgg] = await Promise.all([
    Booking.find(match)
      .sort({ createdAt: -1 })
      .limit(1000)
      .select('bookingCode mode categoryKey status fare createdAt customer driver')
      .populate('customer', 'name')
      .populate('driver', 'name')
      .lean(),
    Booking.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          totalFare: { $sum: '$fare.total' },
        },
      },
    ]),
  ])

  const rows = (bookingDocs as unknown as LeanBookingRow[]).map((b) => ({
    bookingCode: b.bookingCode,
    mode: b.mode,
    categoryKey: b.categoryKey,
    customerName: b.customer?.name ?? 'Unknown',
    driverName: b.driver?.name ?? 'Unassigned',
    status: b.status,
    fareTotal: b.fare?.total ?? 0,
    createdAt: b.createdAt,
  }))

  const summaryDoc = summaryAgg[0] as
    | { total: number; completed: number; cancelled: number; totalFare: number }
    | undefined

  res.json({
    summary: {
      total: summaryDoc?.total ?? 0,
      completed: summaryDoc?.completed ?? 0,
      cancelled: summaryDoc?.cancelled ?? 0,
      totalFare: summaryDoc?.totalFare ?? 0,
    },
    rows,
  })
}

// GET /reports/revenue?from=&to=
export async function getRevenueReport(req: Request, res: Response) {
  const { from, to } = resolveRange(req)
  const dateRangeMatch = { createdAt: { $gte: from, $lte: to } }

  const [revenueAgg, byDayAgg, refundAgg] = await Promise.all([
    Booking.aggregate([
      { $match: { ...dateRangeMatch, status: 'completed' } },
      {
        $group: {
          _id: null,
          grossRevenue: { $sum: '$fare.total' },
          platformCommission: { $sum: '$fare.platformFee' },
        },
      },
    ]),
    Booking.aggregate([
      { $match: { ...dateRangeMatch, status: 'completed' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$fare.total' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Refund.aggregate([
      { $match: { ...dateRangeMatch, status: 'processed' } },
      { $group: { _id: null, refunds: { $sum: '$amount' } } },
    ]),
  ])

  const revenueDoc = revenueAgg[0] as { grossRevenue: number; platformCommission: number } | undefined
  const refundDoc = refundAgg[0] as { refunds: number } | undefined

  const grossRevenue = revenueDoc?.grossRevenue ?? 0
  const platformCommission = revenueDoc?.platformCommission ?? 0
  const refunds = refundDoc?.refunds ?? 0

  const byDay = (byDayAgg as { _id: string; revenue: number }[]).map((d) => ({
    date: d._id,
    revenue: d.revenue ?? 0,
  }))

  res.json({
    summary: {
      grossRevenue,
      platformCommission,
      refunds,
      netRevenue: grossRevenue - refunds,
    },
    byDay,
  })
}

interface LeanDriverRow {
  _id: unknown
  name: string
  serviceType: string
  totalTrips?: number
  earnings?: number
  rating?: number
}

// GET /reports/rider?from=&to=
export async function getRiderReport(req: Request, res: Response) {
  const { from, to } = resolveRange(req)

  const [drivers, bookingAgg] = await Promise.all([
    Driver.find().select('name serviceType totalTrips earnings rating').limit(1000).lean(),
    Booking.aggregate([
      { $match: { driver: { $ne: null }, createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: { driver: '$driver', status: '$status' }, count: { $sum: 1 } } },
    ]),
  ])

  const statsByDriver = new Map<string, { completed: number; cancelled: number }>()
  for (const entry of bookingAgg as { _id: { driver: unknown; status: string }; count: number }[]) {
    const key = String(entry._id.driver)
    const current = statsByDriver.get(key) ?? { completed: 0, cancelled: 0 }
    if (entry._id.status === 'completed') current.completed += entry.count
    if (entry._id.status === 'cancelled') current.cancelled += entry.count
    statsByDriver.set(key, current)
  }

  const rows = (drivers as unknown as LeanDriverRow[]).map((d) => {
    const stats = statsByDriver.get(String(d._id)) ?? { completed: 0, cancelled: 0 }
    return {
      driverName: d.name,
      serviceType: d.serviceType,
      totalTrips: d.totalTrips ?? 0,
      completedInRange: stats.completed,
      cancelledInRange: stats.cancelled,
      earnings: d.earnings ?? 0,
      rating: d.rating ?? 0,
    }
  })

  res.json({ rows })
}

interface LeanPartnerRow {
  _id: unknown
  companyName: string
  vehicleCount?: number
  driverCount?: number
  status: string
}

// GET /reports/partner?from=&to=
export async function getPartnerReport(req: Request, res: Response) {
  const { from, to } = resolveRange(req)

  const [partners, bookingAgg] = await Promise.all([
    TransportPartner.find().select('companyName vehicleCount driverCount status').limit(1000).lean(),
    Booking.aggregate([
      { $match: { partner: { $ne: null }, mode: 'transport', createdAt: { $gte: from, $lte: to } } },
      { $group: { _id: '$partner', deliveries: { $sum: 1 }, revenue: { $sum: '$fare.total' } } },
    ]),
  ])

  const statsByPartner = new Map<string, { deliveries: number; revenue: number }>()
  for (const entry of bookingAgg as { _id: unknown; deliveries: number; revenue: number }[]) {
    statsByPartner.set(String(entry._id), { deliveries: entry.deliveries, revenue: entry.revenue ?? 0 })
  }

  const rows = (partners as unknown as LeanPartnerRow[]).map((p) => {
    const stats = statsByPartner.get(String(p._id)) ?? { deliveries: 0, revenue: 0 }
    return {
      companyName: p.companyName,
      vehicleCount: p.vehicleCount ?? 0,
      driverCount: p.driverCount ?? 0,
      deliveriesInRange: stats.deliveries,
      revenueInRange: stats.revenue,
      status: p.status,
    }
  })

  res.json({ rows })
}

// GET /reports/financial?from=&to=
export async function getFinancialReport(req: Request, res: Response) {
  const { from, to } = resolveRange(req)
  const dateRangeMatch = { createdAt: { $gte: from, $lte: to } }

  const [paymentTotalAgg, refundTotalAgg, walletAgg, paymentByDayAgg, refundByDayAgg] = await Promise.all([
    Payment.aggregate([
      { $match: { ...dateRangeMatch, status: 'success' } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),
    Refund.aggregate([
      { $match: { ...dateRangeMatch, status: 'processed' } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),
    WalletTransaction.aggregate([
      { $match: dateRangeMatch },
      { $group: { _id: '$type', amount: { $sum: '$amount' } } },
    ]),
    Payment.aggregate([
      { $match: { ...dateRangeMatch, status: 'success' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
        },
      },
    ]),
    Refund.aggregate([
      { $match: { ...dateRangeMatch, status: 'processed' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          amount: { $sum: '$amount' },
        },
      },
    ]),
  ])

  const grossRevenue = (paymentTotalAgg[0] as { amount: number } | undefined)?.amount ?? 0
  const refunds = (refundTotalAgg[0] as { amount: number } | undefined)?.amount ?? 0

  let walletCreditsTotal = 0
  let walletDebitsTotal = 0
  for (const entry of walletAgg as { _id: string; amount: number }[]) {
    if (entry._id === 'credit') walletCreditsTotal = entry.amount ?? 0
    if (entry._id === 'debit') walletDebitsTotal = entry.amount ?? 0
  }

  const byDate = new Map<string, { paymentsCount: number; paymentsAmount: number; refundsCount: number; refundsAmount: number }>()
  for (const entry of paymentByDayAgg as { _id: string; count: number; amount: number }[]) {
    const row = byDate.get(entry._id) ?? { paymentsCount: 0, paymentsAmount: 0, refundsCount: 0, refundsAmount: 0 }
    row.paymentsCount = entry.count
    row.paymentsAmount = entry.amount ?? 0
    byDate.set(entry._id, row)
  }
  for (const entry of refundByDayAgg as { _id: string; count: number; amount: number }[]) {
    const row = byDate.get(entry._id) ?? { paymentsCount: 0, paymentsAmount: 0, refundsCount: 0, refundsAmount: 0 }
    row.refundsCount = entry.count
    row.refundsAmount = entry.amount ?? 0
    byDate.set(entry._id, row)
  }

  const rows = Array.from(byDate.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, r]) => ({ date, ...r }))

  res.json({
    summary: {
      grossRevenue,
      refunds,
      netRevenue: grossRevenue - refunds,
      walletCreditsTotal,
      walletDebitsTotal,
    },
    rows,
  })
}
