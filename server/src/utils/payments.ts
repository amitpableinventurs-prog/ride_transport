import crypto from 'crypto'
import { env } from '../config/env'
import { HttpError } from './http'

export interface GatewayOrderResult {
  id: string
  amount: number
  currency: string
}

export interface PaymentProvider {
  name: string
  /** Public key the app passes to the gateway checkout SDK. */
  publicKey?: string
  createOrder(amountRupees: number, receipt: string): Promise<GatewayOrderResult>
  verifySignature(orderId: string, paymentId: string, signature: string): boolean
}

function hmacEquals(secret: string, payload: string, signature: string): boolean {
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

// Development provider: orders are created locally and `signature: "mock_success"` verifies any payment.
const MOCK_SIGNATURE = 'mock_success'
const mockProvider: PaymentProvider = {
  name: 'mock',
  async createOrder(amountRupees) {
    return { id: `order_mock_${crypto.randomBytes(8).toString('hex')}`, amount: amountRupees, currency: 'INR' }
  },
  verifySignature(_orderId, _paymentId, signature) {
    return signature === MOCK_SIGNATURE
  },
}

// Razorpay Orders API: https://razorpay.com/docs/api/orders/
const razorpayProvider: PaymentProvider = {
  name: 'razorpay',
  get publicKey() {
    return env.razorpayKeyId
  },
  async createOrder(amountRupees, receipt) {
    const auth = Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString('base64')
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Math.round(amountRupees * 100), currency: 'INR', receipt }),
    })
    if (!response.ok) {
      console.error('[payments:razorpay] order creation failed', response.status, await response.text())
      throw new HttpError(502, 'Could not start the payment. Please try again.')
    }
    const order = (await response.json()) as { id: string; amount: number; currency: string }
    return { id: order.id, amount: order.amount / 100, currency: order.currency }
  },
  verifySignature(orderId, paymentId, signature) {
    return hmacEquals(env.razorpayKeySecret, `${orderId}|${paymentId}`, signature)
  },
}

const providers: Record<string, PaymentProvider> = { mock: mockProvider, razorpay: razorpayProvider }

export function getPaymentProvider(): PaymentProvider {
  const provider = providers[env.paymentProvider]
  if (!provider) throw new Error(`Unknown PAYMENT_PROVIDER "${env.paymentProvider}". Available: ${Object.keys(providers).join(', ')}`)
  if (provider === mockProvider && env.isProduction) throw new HttpError(503, 'Online payments are not configured')
  if (provider === razorpayProvider && (!env.razorpayKeyId || !env.razorpayKeySecret)) {
    throw new HttpError(503, 'Online payments are not configured')
  }
  return provider
}
