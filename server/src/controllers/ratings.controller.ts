import type { Request, Response } from 'express'
import type { FilterQuery } from 'mongoose'
import { Rating, type RatingDocument } from '../models/Rating'
// Importing Booking/Customer/Driver here registers their Mongoose models for populate(),
// independent of whether other in-progress phases have imported them yet.
import '../models/Booking'
import '../models/Customer'
import '../models/Driver'

export async function listRatings(req: Request, res: Response) {
  const { ratedBy, minScore } = req.query as { ratedBy?: string; minScore?: string }
  const filter: FilterQuery<RatingDocument> = {}
  if (ratedBy) filter.ratedBy = ratedBy as RatingDocument['ratedBy']
  if (minScore) filter.score = { $gte: Number(minScore) }

  const ratings = await Rating.find(filter)
    .populate('booking', 'bookingCode')
    .populate('customer', 'name')
    .populate('driver', 'name')
    .sort({ createdAt: -1 })
  res.json(ratings)
}
