import type { Request, Response } from 'express'
import { Booking } from '../models/Booking'
import { Customer } from '../models/Customer'
import { Driver } from '../models/Driver'
import { TransportPartner } from '../models/TransportPartner'
import { Vehicle } from '../models/Vehicle'
import { Refund } from '../models/Refund'
import { Payment } from '../models/Payment'
import { SosRequest } from '../models/SosRequest'
import { DocumentRecord } from '../models/Document'

const DAY_MS = 24 * 60 * 60 * 1000
const ONGOING_RIDE_STATUSES = ['accepted', 'arriving', 'started']
const ACTIVE_DELIVERY_STATUSES = ['accepted', 'arriving', 'started', 'in_transit']
const STATUS_LABELS: Record<string, string> = {
  requested: 'Requested',
  accepted: 'Accepted',
  arriving: 'Arriving',
  started: 'Ongoing',
  in_transit: 'In Transit',
  completed: 'Completed',
  cancelled: 'Cancelled',
}
// A booking still unassigned after this long is flagged as an operational alert.
const UNASSIGNED_ALERT_MINUTES = 10

const serverTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function sumOf(agg: unknown[], field: string): number {
  return ((agg[0] as Record<string, number> | undefined)?.[field] as number | undefined) ?? 0
}

// All figures are computed live from the collections on every request.
export async function getDashboardStats(_req: Request, res: Response) {
  const now = new Date()
  const today = startOfToday()
  const last30 = new Date(today.getTime() - 29 * DAY_MS)
  const last7 = new Date(today.getTime() - 6 * DAY_MS)

  const [
    customers,
    riders,
    drivers,
    transportPartners,
    vehicles,
    todayBookings,
    ongoingRides,
    activeDeliveries,
    todayCompleted,
    todayCancelled,
    todayRevenueAgg,
    todayRefundAgg,
    modeAgg,
    statusAgg,
    trendAgg,
    recent,
    pendingDrivers,
    pendingPartners,
    pendingDocuments,
    expiredDocuments,
    openSos,
    failedPayments,
    unassignedBookings,
  ] = await Promise.all([
    Customer.countDocuments(),
    Driver.countDocuments({ serviceType: 'rider' }),
    Driver.countDocuments({ serviceType: 'transport' }),
    TransportPartner.countDocuments(),
    Vehicle.countDocuments(),
    Booking.countDocuments({ createdAt: { $gte: today } }),
    Booking.countDocuments({ mode: 'ride', status: { $in: ONGOING_RIDE_STATUSES } }),
    Booking.countDocuments({ mode: 'transport', status: { $in: ACTIVE_DELIVERY_STATUSES } }),
    Booking.countDocuments({ createdAt: { $gte: today }, status: 'completed' }),
    Booking.countDocuments({ createdAt: { $gte: today }, status: 'cancelled' }),
    Booking.aggregate([
      { $match: { createdAt: { $gte: today }, status: 'completed' } },
      { $group: { _id: null, revenue: { $sum: '$fare.total' }, platformFee: { $sum: '$fare.platformFee' } } },
    ]),
    Refund.aggregate([
      { $match: { status: 'processed', processedAt: { $gte: today } } },
      { $group: { _id: null, amount: { $sum: '$amount' } } },
    ]),
    Booking.aggregate([{ $match: { createdAt: { $gte: last30 } } }, { $group: { _id: '$mode', count: { $sum: 1 } } }]),
    Booking.aggregate([{ $match: { createdAt: { $gte: last30 } } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    Booking.aggregate([
      { $match: { createdAt: { $gte: last7 }, status: 'completed' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: serverTimeZone } },
          revenue: { $sum: '$fare.total' },
        },
      },
    ]),
    Booking.find().sort({ createdAt: -1 }).limit(8).populate('customer', 'name').select('bookingCode mode categoryKey status fare customer createdAt'),
    Driver.find({ approvalStatus: 'pending' }).sort({ createdAt: -1 }).limit(6).select('name serviceType createdAt'),
    TransportPartner.find({ approvalStatus: 'pending' }).sort({ createdAt: -1 }).limit(6).select('companyName createdAt'),
    DocumentRecord.countDocuments({ status: 'pending' }),
    DocumentRecord.countDocuments({ status: { $ne: 'expired' }, expiryDate: { $lt: now } }),
    SosRequest.find({ status: { $ne: 'resolved' } }).sort({ createdAt: -1 }).limit(3).select('userName raisedBy createdAt'),
    Payment.countDocuments({ status: 'failed', createdAt: { $gte: new Date(now.getTime() - DAY_MS) } }),
    Booking.countDocuments({
      status: 'requested',
      driver: null,
      createdAt: { $lt: new Date(now.getTime() - UNASSIGNED_ALERT_MINUTES * 60 * 1000) },
    }),
  ])

  // Platform commission is the platform fee collected on completed bookings;
  // the remainder of the fare goes to the rider/driver or transport partner.
  const todayRevenue = sumOf(todayRevenueAgg, 'revenue')
  const platformCommission = sumOf(todayRevenueAgg, 'platformFee')

  const modeCounts = Object.fromEntries((modeAgg as { _id: string; count: number }[]).map((m) => [m._id, m.count]))
  const modeTotal = (modeCounts.ride ?? 0) + (modeCounts.transport ?? 0)
  const ridePct = modeTotal ? Math.round(((modeCounts.ride ?? 0) / modeTotal) * 100) : 0

  const statusCounts = Object.fromEntries((statusAgg as { _id: string; count: number }[]).map((s) => [s._id, s.count]))
  const countOf = (...statuses: string[]) => statuses.reduce((sum, s) => sum + (statusCounts[s] ?? 0), 0)

  const trendByDate = new Map((trendAgg as { _id: string; revenue: number }[]).map((t) => [t._id, t.revenue]))
  const revenueTrend = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(last7.getTime() + i * DAY_MS)
    return {
      day: date.toLocaleDateString('en-IN', { weekday: 'short' }),
      revenue: trendByDate.get(localDateKey(date)) ?? 0,
    }
  })

  const pendingApprovals = [
    ...pendingDrivers.map((d) => ({
      id: d.id as string,
      type: d.serviceType === 'rider' ? 'Rider' : 'Transport rider',
      name: d.name,
      submittedAt: d.createdAt.toISOString(),
    })),
    ...pendingPartners.map((p) => ({
      id: p.id as string,
      type: 'Transport Partner',
      name: p.companyName,
      submittedAt: p.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 6)

  const alerts: { id: string; type: string; message: string; severity: string; createdAt: string }[] = []
  const nowIso = now.toISOString()
  for (const sos of openSos) {
    alerts.push({
      id: `sos-${sos.id}`,
      type: 'sos',
      message: `Open SOS from ${sos.userName} (${sos.raisedBy})`,
      severity: 'high',
      createdAt: sos.createdAt.toISOString(),
    })
  }
  if (unassignedBookings) {
    alerts.push({
      id: 'unassigned-bookings',
      type: 'operational',
      message: `${unassignedBookings} booking(s) waiting over ${UNASSIGNED_ALERT_MINUTES} min for a driver`,
      severity: 'high',
      createdAt: nowIso,
    })
  }
  if (expiredDocuments) {
    alerts.push({ id: 'expired-documents', type: 'document', message: `${expiredDocuments} document(s) past their expiry date`, severity: 'high', createdAt: nowIso })
  }
  if (pendingDocuments) {
    alerts.push({ id: 'pending-documents', type: 'document', message: `${pendingDocuments} document(s) awaiting verification`, severity: 'medium', createdAt: nowIso })
  }
  if (failedPayments) {
    alerts.push({ id: 'failed-payments', type: 'payment', message: `${failedPayments} failed payment(s) in the last 24 hours`, severity: 'medium', createdAt: nowIso })
  }

  res.json({
    totals: { customers, riders, drivers, transportPartners, vehicles },
    today: {
      bookings: todayBookings,
      ongoingRides,
      activeDeliveries,
      completed: todayCompleted,
      cancelled: todayCancelled,
    },
    revenue: {
      todayRevenue,
      platformCommission,
      partnerEarnings: todayRevenue - platformCommission,
      refunds: sumOf(todayRefundAgg, 'amount'),
    },
    serviceSplit: [
      { label: 'Ride', value: ridePct },
      { label: 'Transport', value: modeTotal ? 100 - ridePct : 0 },
    ],
    bookingStatusDistribution: [
      { label: 'Completed', value: countOf('completed'), color: '#16a34a' },
      { label: 'Ongoing', value: countOf('accepted', 'arriving', 'started', 'in_transit'), color: '#f5820c' },
      { label: 'Cancelled', value: countOf('cancelled'), color: '#dc2626' },
      { label: 'Pending', value: countOf('requested'), color: '#4a5f8f' },
    ],
    revenueTrend,
    recentBookings: recent.map((b) => ({
      id: b.bookingCode,
      customer: (b.customer as unknown as { name?: string } | null)?.name ?? 'Unknown',
      mode: b.mode === 'ride' ? 'Ride' : 'Transport',
      category: b.categoryKey,
      status: STATUS_LABELS[b.status] ?? b.status,
      fare: b.fare?.total ?? 0,
      createdAt: b.createdAt.toISOString(),
    })),
    pendingApprovals,
    alerts,
  })
}
