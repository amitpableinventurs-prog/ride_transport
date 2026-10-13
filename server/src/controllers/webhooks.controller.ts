// Payment gateway webhooks (no login; trusted only through the signature).
import type { Request, Response } from 'express'
import { handleRazorpayWebhook } from '../services/gatewayPayments'

// POST /api/v1/webhooks/razorpay: raw JSON body + X-Razorpay-Signature. A non-2xx reply makes Razorpay retry.
export async function razorpayWebhook(req: Request, res: Response) {
  const signature = req.header('x-razorpay-signature') ?? ''
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
  res.json(await handleRazorpayWebhook(rawBody, signature))
}
