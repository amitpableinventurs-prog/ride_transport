import type { Request, Response } from 'express'
import { Payment } from '../models/Payment'
import { Booking } from '../models/Booking'

function parsePagination(query: Record<string, string>) {
  const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20))
  return { page, pageSize }
}

export async function listPayments(req: Request, res: Response) {
  const query = req.query as Record<string, string>
  const { status, method, q } = query
  const filter: Record<string, unknown> = {}
  if (status) filter.status = status
  if (method) filter.method = method

  if (q && q.trim()) {
    const matchingBookings = await Booking.find({ bookingCode: { $regex: q.trim(), $options: 'i' } }).select('_id')
    filter.booking = { $in: matchingBookings.map((b) => b._id) }
  }

  const { page, pageSize } = parsePagination(query)

  const [items, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .populate({
        path: 'booking',
        select: 'bookingCode customer',
        populate: { path: 'customer', select: 'name' },
      }),
    Payment.countDocuments(filter),
  ])

  res.json({ items, total, page, pageSize })
}
