import type { HydratedDocument, Types } from 'mongoose'
import { env } from '../config/env'
import { Booking, type BookingDocument } from '../models/Booking'
import { GatewayOrder, type GatewayOrderDocument } from '../models/GatewayOrder'
import { emitBookingEvent, emitToRider } from '../realtime/socket'
import { HttpError, requireString } from '../utils/http'
import { notifyUser } from '../utils/notify'
import { getPaymentProvider } from '../utils/payments'
import { creditWallet, getOrCreateWallet } from '../utils/wallet'
import { applyGatewayRefundStatus } from './refunds'
import { settleBookingPayment } from './trips'

interface OrderRequest {
  purpose: GatewayOrderDocument['purpose']
  ownerType: 'customer' | 'driver'
  ownerId: Types.ObjectId
  amount: number
  booking?: Types.ObjectId
}

type Owner = { type: 'customer' | 'driver'; id: Types.ObjectId }
type StoredOrder = HydratedDocument<GatewayOrderDocument>

// Orders still unpaid this long after creation are no longer checked with the gateway.
const RECONCILE_WINDOW_MS = 24 * 60 * 60_000
// Give the app time to call /payments/verify itself before the sweeper asks the gateway.
const RECONCILE_MIN_AGE_MS = 60_000
const RECONCILE_INTERVAL_MS = 2 * 60_000
// Checked every sweep while fresh, then hourly, so abandoned checkouts don't flood the gateway API.
const RECONCILE_FRESH_MS = 30 * 60_000
const RECONCILE_SLOW_INTERVAL_MS = 60 * 60_000
// A rider's payment QR closes on its own after this long.
const QR_LIFETIME_MS = 20 * 60_000
// An open QR is shown again unless it closes within this long.
const QR_REUSE_MIN_LEFT_MS = 2 * 60_000

/** Creates a gateway order the app completes with the gateway's checkout SDK, then sends to /payments/verify. */
export async function createGatewayOrder(input: OrderRequest) {
  const provider = getPaymentProvider()
  const receipt = `${input.purpose}_${input.ownerId.toString().slice(-8)}_${Date.now().toString(36)}`
  const order = await provider.createOrder(input.amount, receipt)
  await GatewayOrder.create({ ...input, provider: provider.name, providerOrderId: order.id, amount: order.amount })
  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency,
    purpose: input.purpose,
    provider: provider.name,
    key: provider.publicKey,
  }
}

async function paidResult(order: StoredOrder, extra: { alreadyProcessed?: boolean; creditedToWallet?: boolean } = {}) {
  const wallet = order.purpose === 'booking' && !extra.creditedToWallet ? null : await getOrCreateWallet(order.ownerType, order.ownerId)
  return {
    status: 'paid' as const,
    purpose: order.purpose,
    amount: order.amount,
    ...(order.booking ? { bookingId: order.booking.toString() } : {}),
    ...(wallet ? { walletBalance: wallet.balance } : {}),
    ...extra,
  }
}

/**
 * Applies a paid gateway order exactly once, whichever path learns of it first
 * (the app's /payments/verify, the status check, the webhook or the sweeper).
 */
async function applyPaidOrder(order: StoredOrder, paymentId: string) {
  const claimed = await GatewayOrder.findOneAndUpdate(
    { _id: order._id, status: 'created' },
    { $set: { status: 'paid', providerPaymentId: paymentId, paidAt: new Date() } },
    { new: true },
  )
  if (!claimed) return paidResult((await GatewayOrder.findById(order._id))!, { alreadyProcessed: true })

  const ref = { referenceType: 'GatewayOrder', referenceId: claimed._id }
  if (claimed.purpose === 'booking') {
    const settled = await settleBookingPayment(claimed.booking!.toString(), {
      method: 'online',
      gateway: claimed.provider === 'razorpay' ? 'razorpay' : 'internal',
      gatewayRefId: paymentId,
    })
    // The booking was already paid (wallet, cash or a second checkout): keep the money in the customer's wallet.
    if (!settled) {
      await creditWallet({ ownerType: claimed.ownerType, ownerId: claimed.ownerId, amount: claimed.amount, reason: 'refund', ...ref })
      console.warn(`[payments] booking ${claimed.booking} was already paid; ${claimed.providerOrderId} credited to the wallet`)
      return paidResult(claimed, { creditedToWallet: true })
    }
    await announceBookingPaid(settled, claimed)
  } else {
    await creditWallet({ ownerType: claimed.ownerType, ownerId: claimed.ownerId, amount: claimed.amount, reason: 'recharge', ...ref })
  }
  return paidResult(claimed)
}

/** Tells the customer, the admins and the rider (who left the booking room at completion) that the fare was paid online. */
async function announceBookingPaid(booking: HydratedDocument<BookingDocument>, order: StoredOrder) {
  const timestamp = new Date().toISOString()
  emitBookingEvent(booking.id, 'booking:status', { bookingId: booking.id, status: booking.status, paymentStatus: booking.paymentStatus, timestamp }, ['customer', 'admin'])
  if (!booking.driver) return
  emitToRider(booking.driver, 'booking:payment_received', { bookingId: booking.id, amount: order.amount, channel: order.channel, paymentStatus: booking.paymentStatus, timestamp })
  await notifyUser('driver', booking.driver, {
    title: 'Payment received',
    body: `₹${order.amount} for trip ${booking.bookingCode} was paid online and added to your earnings.`,
    data: { bookingId: booking.id, type: 'payment_received' },
  })
}

/** Asks the gateway whether an unpaid order was paid and applies it if so. */
async function reconcileOrder(order: StoredOrder) {
  const provider = getPaymentProvider()
  if (order.provider !== provider.name) return null
  const paymentId = order.channel === 'upi_qr' ? await provider.findQrPayment(order.providerOrderId) : await provider.findCapturedPayment(order.providerOrderId)
  return paymentId ? applyPaidOrder(order, paymentId) : null
}

function findOwnOrder(owner: Owner, orderId: string) {
  return GatewayOrder.findOne({ providerOrderId: orderId, ownerType: owner.type, ownerId: owner.id })
}

/** Checks the gateway signature and applies the payment exactly once. */
export async function verifyGatewayPayment(owner: Owner, body: Record<string, unknown>) {
  const orderId = requireString(body.orderId, 'orderId')
  const paymentId = requireString(body.paymentId, 'paymentId')
  const signature = requireString(body.signature, 'signature')

  const order = await findOwnOrder(owner, orderId)
  if (!order) throw new HttpError(404, 'Payment order not found')
  if (order.status === 'paid') return paidResult(order, { alreadyProcessed: true })

  const provider = getPaymentProvider()
  if (order.provider !== provider.name || !provider.verifySignature(orderId, paymentId, signature)) {
    throw new HttpError(400, 'Payment could not be verified')
  }
  return applyPaidOrder(order, paymentId)
}

/**
 * Payment status for the app to poll after checkout (or after it was closed mid-payment).
 * An unpaid order is checked with the gateway, so a captured payment is applied even without /payments/verify.
 */
export async function getGatewayOrderStatus(owner: Owner, orderId: string) {
  const order = await findOwnOrder(owner, orderId)
  if (!order) throw new HttpError(404, 'Payment order not found')
  if (order.status === 'paid') return paidResult(order, { alreadyProcessed: true })

  const applied = await reconcileOrder(order)
  if (applied) return applied
  return { status: order.status, purpose: order.purpose, amount: order.amount, ...(order.booking ? { bookingId: order.booking.toString() } : {}) }
}

function qrResult(order: StoredOrder) {
  return {
    qrId: order.providerOrderId,
    status: order.status,
    amount: order.amount,
    currency: order.currency,
    imageUrl: order.qrImageUrl ?? null,
    upiUri: order.qrUpiUri ?? null,
    closesAt: order.closesAt,
    provider: order.provider,
  }
}

type QrBooking = Pick<HydratedDocument<BookingDocument>, '_id' | 'id' | 'customer' | 'bookingCode' | 'fare'>

/**
 * A UPI QR the rider shows so the customer can pay a completed booking online.
 * An open QR for the same amount is shown again instead of creating another one.
 */
export async function createBookingPaymentQr(booking: QrBooking) {
  const amount = booking.fare?.total ?? 0
  if (amount <= 0) throw new HttpError(409, 'Nothing to collect for this trip')

  const open = await GatewayOrder.findOne({
    booking: booking._id,
    channel: 'upi_qr',
    status: 'created',
    amount,
    provider: env.paymentProvider,
    closesAt: { $gt: new Date(Date.now() + QR_REUSE_MIN_LEFT_MS) },
  }).sort({ createdAt: -1 })
  if (open) return qrResult(open)

  const provider = getPaymentProvider()
  const closesAt = new Date(Date.now() + QR_LIFETIME_MS)
  const qr = await provider.createUpiQr(amount, {
    description: `AnZ Cabs trip ${booking.bookingCode}`,
    closesAt,
    notes: { bookingId: booking.id, bookingCode: booking.bookingCode },
  })
  const order = await GatewayOrder.create({
    purpose: 'booking',
    channel: 'upi_qr',
    // The customer pays: if the booking gets paid some other way first, the money goes to their wallet.
    ownerType: 'customer',
    ownerId: booking.customer,
    booking: booking._id,
    amount: qr.amount,
    provider: provider.name,
    providerOrderId: qr.id,
    qrImageUrl: qr.imageUrl,
    qrUpiUri: qr.upiUri,
    closesAt,
  })
  return qrResult(order)
}

/** For the rider to poll while the QR is on screen; an unpaid QR is checked with the gateway. */
export async function getBookingPaymentQrStatus(bookingId: string) {
  let order = await GatewayOrder.findOne({ booking: bookingId, channel: 'upi_qr' }).sort({ createdAt: -1 })
  if (!order) throw new HttpError(404, 'No payment QR was created for this booking')

  const pending = await Booking.exists({ _id: bookingId, paymentStatus: 'pending' })
  if (order.status === 'created' && pending) {
    await reconcileOrder(order)
    order = (await GatewayOrder.findById(order._id))!
  }
  const booking = await Booking.findById(bookingId).select('paymentStatus')
  return {
    bookingId,
    paymentStatus: booking?.paymentStatus ?? 'pending',
    qr: { ...qrResult(order), expired: order.status === 'created' && Boolean(order.closesAt && order.closesAt <= new Date()) },
  }
}

/** Closes a booking's open QRs once it is paid another way (e.g. cash). A payment that still slips through goes to the customer's wallet. */
export async function closeBookingPaymentQrs(bookingId: string) {
  const open = await GatewayOrder.find({ booking: bookingId, channel: 'upi_qr', status: 'created', closesAt: { $gt: new Date() } })
  if (!open.length) return
  const provider = getPaymentProvider()
  for (const order of open) {
    if (order.provider === provider.name) await provider.closeUpiQr(order.providerOrderId)
  }
}

/**
 * Razorpay webhook: payment.captured / order.paid / qr_code.credited apply payments the app never confirmed;
 * refund.processed / refund.failed track refunds.
 */
export async function handleRazorpayWebhook(rawBody: Buffer, signature: string) {
  const provider = getPaymentProvider()
  if (provider.name !== 'razorpay' || !provider.verifyWebhookSignature(rawBody, signature)) {
    throw new HttpError(400, 'Invalid webhook signature')
  }

  const event = JSON.parse(rawBody.toString('utf8')) as {
    event?: string
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; status?: string } }
      order?: { entity?: { id?: string } }
      qr_code?: { entity?: { id?: string } }
      refund?: { entity?: { id?: string } }
    }
  }
  if (event.event === 'refund.processed' || event.event === 'refund.failed') {
    const refundId = event.payload?.refund?.entity?.id
    if (!refundId) return { handled: false }
    await applyGatewayRefundStatus(refundId, event.event === 'refund.processed' ? 'processed' : 'failed')
    return { handled: true }
  }
  const payment = event.payload?.payment?.entity
  if (event.event === 'qr_code.credited') {
    const qrId = event.payload?.qr_code?.entity?.id
    if (!qrId || !payment?.id || payment.status !== 'captured') return { handled: false }
    const order = await GatewayOrder.findOne({ providerOrderId: qrId, provider: 'razorpay', channel: 'upi_qr' })
    if (!order) {
      console.warn('[payments:webhook] unknown QR', qrId)
      return { handled: false }
    }
    await applyPaidOrder(order, payment.id)
    return { handled: true }
  }
  if (event.event !== 'payment.captured' && event.event !== 'order.paid') return { handled: false }

  const orderEntity = event.payload?.order?.entity
  const orderId = payment?.order_id ?? orderEntity?.id
  if (!orderId) return { handled: false }

  const order = await GatewayOrder.findOne({ providerOrderId: orderId, provider: 'razorpay' })
  if (!order) {
    console.warn('[payments:webhook] unknown order', orderId)
    return { handled: false }
  }

  if (event.event === 'payment.captured') {
    if (!payment?.id || payment.status !== 'captured') return { handled: false }
    await applyPaidOrder(order, payment.id)
    return { handled: true }
  }

  const paymentId = await provider.findCapturedPayment(orderId)
  if (!paymentId) return { handled: false }
  await applyPaidOrder(order, paymentId)
  return { handled: true }
}

/** Safety net: applies recent orders that were paid but never confirmed by the app or a webhook. */
async function reconcileSweep() {
  if (env.paymentProvider === 'mock') return
  const now = Date.now()
  const pending = await GatewayOrder.find({
    status: 'created',
    provider: env.paymentProvider,
    createdAt: { $gte: new Date(now - RECONCILE_WINDOW_MS), $lte: new Date(now - RECONCILE_MIN_AGE_MS) },
    $or: [
      { createdAt: { $gte: new Date(now - RECONCILE_FRESH_MS) } },
      { lastCheckedAt: null },
      { lastCheckedAt: { $lte: new Date(now - RECONCILE_SLOW_INTERVAL_MS) } },
    ],
  })
    .sort({ createdAt: -1 })
    .limit(50)

  for (const order of pending) {
    await GatewayOrder.updateOne({ _id: order._id }, { $set: { lastCheckedAt: new Date() } })
    const applied = await reconcileOrder(order).catch((err) => console.error('[payments:reconcile]', order.providerOrderId, err))
    if (applied && !applied.alreadyProcessed) console.log(`[payments:reconcile] applied ${order.providerOrderId} (${order.purpose}, ₹${order.amount})`)
  }
}

export function startGatewayReconciler() {
  const run = () => void reconcileSweep().catch((err) => console.error('[payments:reconcile]', err))
  run()
  setInterval(run, RECONCILE_INTERVAL_MS).unref()
}
