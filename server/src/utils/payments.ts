import crypto from 'crypto'
import { env } from '../config/env'
import { HttpError } from './http'

export interface GatewayOrderResult {
  id: string
  amount: number
  currency: string
}

export interface GatewayQrResult {
  id: string
  amount: number
  /** Gateway-hosted QR image (Razorpay); null when the app should draw the QR from `upiUri`. */
  imageUrl: string | null
  /** UPI intent the QR encodes, when the gateway exposes it. */
  upiUri: string | null
}

export interface GatewayRefundResult {
  id: string
  status: 'pending' | 'processed' | 'failed'
}

export interface PaymentProvider {
  name: string
  /** Public key the app passes to the gateway checkout SDK. */
  publicKey?: string
  createOrder(amountRupees: number, receipt: string): Promise<GatewayOrderResult>
  verifySignature(orderId: string, paymentId: string, signature: string): boolean
  /** Asks the gateway whether the order was paid; returns the captured payment id or null. */
  findCapturedPayment(orderId: string): Promise<string | null>
  /** Creates a single-use UPI QR for a fixed amount that closes on its own at `closesAt`. */
  createUpiQr(amountRupees: number, opts: { description: string; closesAt: Date; notes: Record<string, string> }): Promise<GatewayQrResult>
  /** Asks the gateway whether the QR was paid; returns the captured payment id or null. */
  findQrPayment(qrId: string): Promise<string | null>
  /** Closes an unpaid QR so it can no longer be paid. */
  closeUpiQr(qrId: string): Promise<void>
  /** Checks a webhook's signature over the raw request body. */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean
  /** Refunds (part of) a captured payment back to the customer's bank, card or UPI. */
  refundPayment(paymentId: string, amountRupees: number, receipt: string): Promise<GatewayRefundResult>
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
  async findCapturedPayment() {
    return null
  },
  // Pay a mock QR from the customer app: POST /customer/payments/verify with the QR id as orderId and signature "mock_success".
  async createUpiQr(amountRupees, opts) {
    const id = `qr_mock_${crypto.randomBytes(8).toString('hex')}`
    const params = new URLSearchParams({ pa: 'anzcabs.mock@upi', pn: 'AnZ Cabs', am: amountRupees.toFixed(2), cu: 'INR', tr: id, tn: opts.description })
    return { id, amount: amountRupees, imageUrl: null, upiUri: `upi://pay?${params.toString()}` }
  },
  async findQrPayment() {
    return null
  },
  async closeUpiQr() {},
  verifyWebhookSignature() {
    return false
  },
  async refundPayment() {
    return { id: `rfnd_mock_${crypto.randomBytes(8).toString('hex')}`, status: 'processed' }
  },
}

function razorpayAuthHeader() {
  return `Basic ${Buffer.from(`${env.razorpayKeyId}:${env.razorpayKeySecret}`).toString('base64')}`
}

// Razorpay Orders API: https://razorpay.com/docs/api/orders/
const razorpayProvider: PaymentProvider = {
  name: 'razorpay',
  get publicKey() {
    return env.razorpayKeyId
  },
  async createOrder(amountRupees, receipt) {
    const response = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: razorpayAuthHeader(), 'Content-Type': 'application/json' },
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
  // https://razorpay.com/docs/api/orders/fetch-payments/
  async findCapturedPayment(orderId) {
    const response = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(orderId)}/payments`, {
      headers: { Authorization: razorpayAuthHeader() },
    })
    if (!response.ok) {
      console.error('[payments:razorpay] fetching order payments failed', orderId, response.status, await response.text())
      throw new HttpError(502, 'Could not check the payment status. Please try again.')
    }
    const { items = [] } = (await response.json()) as { items?: { id: string; status: string }[] }
    return items.find((p) => p.status === 'captured')?.id ?? null
  },
  // https://razorpay.com/docs/api/qr-codes/create/ (QR Codes must be enabled on the Razorpay account)
  async createUpiQr(amountRupees, opts) {
    const response = await fetch('https://api.razorpay.com/v1/payments/qr_codes', {
      method: 'POST',
      headers: { Authorization: razorpayAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'upi_qr',
        name: 'AnZ Cabs',
        usage: 'single_use',
        fixed_amount: true,
        payment_amount: Math.round(amountRupees * 100),
        description: opts.description,
        close_by: Math.floor(opts.closesAt.getTime() / 1000),
        notes: opts.notes,
      }),
    })
    if (!response.ok) {
      console.error('[payments:razorpay] QR creation failed', response.status, await response.text())
      throw new HttpError(502, 'Could not create the payment QR. Please try again or collect cash.')
    }
    const qr = (await response.json()) as { id: string; image_url: string; payment_amount: number }
    return { id: qr.id, amount: qr.payment_amount / 100, imageUrl: qr.image_url, upiUri: null }
  },
  // https://razorpay.com/docs/api/qr-codes/fetch-payments/
  async findQrPayment(qrId) {
    const response = await fetch(`https://api.razorpay.com/v1/payments/qr_codes/${encodeURIComponent(qrId)}/payments`, {
      headers: { Authorization: razorpayAuthHeader() },
    })
    if (!response.ok) {
      console.error('[payments:razorpay] fetching QR payments failed', qrId, response.status, await response.text())
      throw new HttpError(502, 'Could not check the payment status. Please try again.')
    }
    const { items = [] } = (await response.json()) as { items?: { id: string; status: string }[] }
    return items.find((p) => p.status === 'captured')?.id ?? null
  },
  // https://razorpay.com/docs/api/qr-codes/close/
  async closeUpiQr(qrId) {
    const response = await fetch(`https://api.razorpay.com/v1/payments/qr_codes/${encodeURIComponent(qrId)}/close`, {
      method: 'POST',
      headers: { Authorization: razorpayAuthHeader() },
    })
    // Already closed (paid or past close_by) is fine.
    if (!response.ok) console.warn('[payments:razorpay] closing QR failed', qrId, response.status, await response.text())
  },
  // https://razorpay.com/docs/webhooks/validate-test/
  verifyWebhookSignature(rawBody, signature) {
    return Boolean(env.razorpayWebhookSecret) && hmacEquals(env.razorpayWebhookSecret, rawBody.toString('utf8'), signature)
  },
  // https://razorpay.com/docs/api/refunds/create-normal/
  async refundPayment(paymentId, amountRupees, receipt) {
    const response = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(paymentId)}/refund`, {
      method: 'POST',
      headers: { Authorization: razorpayAuthHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Math.round(amountRupees * 100), speed: 'normal', receipt }),
    })
    if (!response.ok) {
      const text = await response.text()
      console.error('[payments:razorpay] refund failed', paymentId, response.status, text)
      let reason = ''
      try {
        reason = (JSON.parse(text) as { error?: { description?: string } }).error?.description ?? ''
      } catch {
        // not JSON
      }
      throw new HttpError(502, reason ? `Razorpay refused the refund: ${reason}` : 'Could not reach Razorpay for the refund. Please try again.')
    }
    const refund = (await response.json()) as { id: string; status: GatewayRefundResult['status'] }
    return { id: refund.id, status: refund.status }
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
