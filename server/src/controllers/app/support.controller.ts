// SOS, support tickets and the notification inbox, shared by the customer and rider apps.
import type { Request, Response } from 'express'
import { AppNotification } from '../../models/AppNotification'
import { Booking } from '../../models/Booking'
import { NotificationBroadcast } from '../../models/NotificationBroadcast'
import { SosRequest } from '../../models/SosRequest'
import { Ticket } from '../../models/Ticket'
import { emitToAdmins } from '../../realtime/socket'
import type { AppUser } from '../../utils/appUsers'
import { parseLatLng } from '../../utils/geo'
import { HttpError, optionalString, parsePagination, requireObjectId, requireString } from '../../utils/http'
import { getSmsProvider } from '../../utils/sms'

const TICKET_CATEGORIES = ['payment', 'booking', 'driver', 'vehicle', 'lost_item', 'refund', 'cancellation', 'technical'] as const
const ANNOUNCEMENT_DAYS = 30

type PersonUser = Extract<AppUser, { type: 'customer' | 'driver' }>

function personUser(req: Request): PersonUser {
  const user = req.appUser!
  if (user.type === 'partner') throw new HttpError(403, 'Not available for partner accounts')
  return user
}

const displayName = (user: PersonUser) => user.doc.name || user.doc.phone

/** Booking the user is part of (as customer or rider); 404 otherwise. */
async function ownBooking(user: PersonUser, bookingId: unknown) {
  const field = user.type === 'customer' ? 'customer' : 'driver'
  const booking = await Booking.findOne({ _id: requireObjectId(bookingId, 'bookingId'), [field]: user.doc._id })
  if (!booking) throw new HttpError(404, 'Booking not found')
  return booking
}

// POST /sos
export async function raiseSos(req: Request, res: Response) {
  const user = personUser(req)
  const body = req.body as Record<string, unknown>
  const location = parseLatLng(body.lat, body.lng)
  if (!location) throw new HttpError(400, 'lat and lng are required')
  const booking = body.bookingId ? await ownBooking(user, body.bookingId) : null

  const note = optionalString(body.note, 500)
  const sos = await SosRequest.create({
    booking: booking?._id ?? null,
    raisedBy: user.type,
    userName: displayName(user),
    location,
    notes: note ? [{ by: displayName(user), text: note }] : [],
  })

  emitToAdmins('sos:alert', {
    sosId: sos.id,
    user: { id: user.doc.id, type: user.type === 'driver' ? 'rider' : 'customer', name: displayName(user), phone: user.doc.phone },
    booking: booking ? { id: booking.id, bookingCode: booking.bookingCode, status: booking.status } : null,
    location,
    createdAt: sos.createdAt,
  })

  // Alert the user's emergency contacts by SMS with a map link.
  const contacts =
    user.type === 'customer' && user.doc.emergencyContacts.length
      ? user.doc.emergencyContacts
      : user.doc.emergencyContact
        ? [user.doc.emergencyContact]
        : []
  const mapLink = `https://maps.google.com/?q=${location.lat},${location.lng}`
  const sms = getSmsProvider()
  await Promise.all(
    contacts.map((c) =>
      sms.send(c.phone, `SOS from ${displayName(user)} via AnZ Cabs${booking ? ` (trip ${booking.bookingCode})` : ''}. Location: ${mapLink}`).catch((err) => console.error('[sos] sms failed', err)),
    ),
  )

  res.status(201).json({ sos, contactsNotified: contacts.length })
}

// GET /tickets
export async function listTickets(req: Request, res: Response) {
  const user = personUser(req)
  const { page, limit, skip } = parsePagination(req)
  const filter = { raisedByType: user.type, raisedById: user.doc._id }
  const [items, total] = await Promise.all([
    Ticket.find(filter).select('-assignedTo').populate('booking', 'bookingCode mode status').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Ticket.countDocuments(filter),
  ])
  res.json({ items, total, page, limit })
}

// POST /tickets
export async function createTicket(req: Request, res: Response) {
  const user = personUser(req)
  const body = req.body as Record<string, unknown>
  const category = body.category as (typeof TICKET_CATEGORIES)[number]
  if (!TICKET_CATEGORIES.includes(category)) throw new HttpError(400, `category must be one of: ${TICKET_CATEGORIES.join(', ')}`)
  const booking = body.bookingId ? await ownBooking(user, body.bookingId) : null

  const ticket = await Ticket.create({
    subject: requireString(body.subject, 'subject', 150),
    description: optionalString(body.description, 2000),
    category,
    raisedByType: user.type,
    raisedById: user.doc._id,
    raisedByName: displayName(user),
    booking: booking?._id ?? null,
  })
  res.status(201).json(ticket)
}

// GET /notifications: personal inbox plus recent announcements (admin broadcasts).
export async function listNotifications(req: Request, res: Response) {
  const user = personUser(req)
  const { page, limit, skip } = parsePagination(req)
  const filter = { userType: user.type, userId: user.doc._id }
  const since = new Date(Math.max(user.doc.createdAt.getTime(), Date.now() - ANNOUNCEMENT_DAYS * 86_400_000))

  const [items, total, unreadCount, announcements] = await Promise.all([
    AppNotification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    AppNotification.countDocuments(filter),
    AppNotification.countDocuments({ ...filter, readAt: null }),
    NotificationBroadcast.find({
      channel: 'push',
      audience: user.type === 'customer' ? 'all_customers' : 'all_drivers',
      createdAt: { $gte: since },
    })
      .select('title body serviceModeFilter createdAt')
      .sort({ createdAt: -1 })
      .limit(20),
  ])

  // Opening the inbox marks this page as read.
  const unreadIds = items.filter((n) => !n.readAt).map((n) => n._id)
  if (unreadIds.length) await AppNotification.updateMany({ _id: { $in: unreadIds } }, { readAt: new Date() })

  res.json({ items, total, page, limit, unreadCount, announcements })
}
