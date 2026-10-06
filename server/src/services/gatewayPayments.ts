import type { Types } from 'mongoose'
import { GatewayOrder, type GatewayOrderDocument } from '../models/GatewayOrder'
import { HttpError, requireString } from '../utils/http'
import { getPaymentProvider } from '../utils/payments'
import { creditWallet, getOrCreateWallet } from '../utils/wallet'
import { settleBookingPayment } from './trips'

interface OrderRequest {
  purpose: GatewayOrderDocument['purpose']
  ownerType: 'customer' | 'driver'
  ownerId: Types.ObjectId
  amount: number
  booking?: Types.ObjectId
}

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

/** Checks the gateway signature and applies the payment exactly once. */
export async function verifyGatewayPayment(owner: { type: 'customer' | 'driver'; id: Types.ObjectId }, body: Record<string, unknown>) {
  const orderId = requireString(body.orderId, 'orderId')
  const paymentId = requireString(body.paymentId, 'paymentId')
  const signature = requireString(body.signature, 'signature')

  const order = await GatewayOrder.findOne({ providerOrderId: orderId, ownerType: owner.type, ownerId: owner.id })
  if (!order) throw new HttpError(404, 'Payment order not found')
  if (order.status === 'paid') return { status: 'paid', purpose: order.purpose, alreadyProcessed: true }

  const provider = getPaymentProvider()
  if (order.provider !== provider.name || !provider.verifySignature(orderId, paymentId, signature)) {
    throw new HttpError(400, 'Payment could not be verified')
  }

  const claimed = await GatewayOrder.findOneAndUpdate(
    { _id: order._id, status: 'created' },
    { $set: { status: 'paid', providerPaymentId: paymentId, paidAt: new Date() } },
    { new: true },
  )
  if (!claimed) return { status: 'paid', purpose: order.purpose, alreadyProcessed: true }

  const ref = { referenceType: 'GatewayOrder', referenceId: claimed._id }
  if (claimed.purpose === 'booking') {
    await settleBookingPayment(claimed.booking!.toString(), {
      method: 'online',
      gateway: provider.name === 'razorpay' ? 'razorpay' : 'internal',
      gatewayRefId: paymentId,
    })
  } else {
    await creditWallet({ ownerType: owner.type, ownerId: owner.id, amount: claimed.amount, reason: 'recharge', ...ref })
  }

  const wallet = claimed.purpose === 'booking' ? null : await getOrCreateWallet(owner.type, owner.id)
  return {
    status: 'paid',
    purpose: claimed.purpose,
    amount: claimed.amount,
    ...(claimed.booking ? { bookingId: claimed.booking.toString() } : {}),
    ...(wallet ? { walletBalance: wallet.balance } : {}),
  }
}
