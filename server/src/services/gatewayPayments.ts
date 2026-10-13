import type { HydratedDocument, Types } from 'mongoose'
import { env } from '../config/env'
import { GatewayOrder, type GatewayOrderDocument } from '../models/GatewayOrder'
import { HttpError, requireString } from '../utils/http'
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
  } else {
    await creditWallet({ ownerType: claimed.ownerType, ownerId: claimed.ownerId, amount: claimed.amount, reason: 'recharge', ...ref })
  }
  return paidResult(claimed)
}

/** Asks the gateway whether an unpaid order was paid and applies it if so. */
async function reconcileOrder(order: StoredOrder) {
  const provider = getPaymentProvider()
  if (order.provider !== provider.name) return null
  const paymentId = await provider.findCapturedPayment(order.providerOrderId)
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

/** Razorpay webhook: payment.captured / order.paid apply payments the app never confirmed; refund.processed / refund.failed track refunds. */
export async function handleRazorpayWebhook(rawBody: Buffer, signature: string) {
  const provider = getPaymentProvider()
  if (provider.name !== 'razorpay' || !provider.verifyWebhookSignature(rawBody, signature)) {
    throw new HttpError(400, 'Invalid webhook signature')
  }

  const event = JSON.parse(rawBody.toString('utf8')) as {
    event?: string
    payload?: {
      payment?: { entity?: { id?: string; order_id?: string; status?: string } }
      refund?: { entity?: { id?: string } }
    }
  }
  if (event.event === 'refund.processed' || event.event === 'refund.failed') {
    const refundId = event.payload?.refund?.entity?.id
    if (!refundId) return { handled: false }
    await applyGatewayRefundStatus(refundId, event.event === 'refund.processed' ? 'processed' : 'failed')
    return { handled: true }
  }
  if (event.event !== 'payment.captured' && event.event !== 'order.paid') return { handled: false }

  const payment = event.payload?.payment?.entity
  if (!payment?.id || !payment.order_id || payment.status !== 'captured') return { handled: false }

  const order = await GatewayOrder.findOne({ providerOrderId: payment.order_id, provider: 'razorpay' })
  if (!order) {
    console.warn('[payments:webhook] unknown order', payment.order_id)
    return { handled: false }
  }
  await applyPaidOrder(order, payment.id)
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
