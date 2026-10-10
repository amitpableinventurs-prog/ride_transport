// Customer app Profile tab: the menu itself, Help, Safety, Claims and Settings.
import type { Request, Response } from 'express'
import type { HydratedDocument } from 'mongoose'
import { env } from '../../config/env'
import { AppNotification } from '../../models/AppNotification'
import { Booking, OPEN_BOOKING_STATUSES } from '../../models/Booking'
import { CmsPage } from '../../models/CmsPage'
import type { CustomerDocument } from '../../models/Customer'
import { CLAIM_TYPES, Ticket } from '../../models/Ticket'
import { isProfileComplete } from '../../utils/appUsers'
import { HttpError, parseAmount, parsePagination, requireObjectId, requireString } from '../../utils/http'
import { getPlatformSettings } from '../../utils/settings'
import { uploadedFileUrl } from '../../utils/uploads'
import { APP_LANGUAGES } from '../app/profile.controller'
import { TICKET_CATEGORIES } from '../app/support.controller'
import { contactsOf, MAX_EMERGENCY_CONTACTS } from './account.controller'

const CLAIM_WINDOW_DAYS = 7
const CLAIM_PHOTO_FIELDS = ['photo1', 'photo2', 'photo3']
const CLOSED_TICKET_STATUSES = ['resolved', 'closed']
const BOOKING_BRIEF_FIELDS = 'bookingCode mode status pickup drop stops.address fare.total createdAt completedAt'

function customerDoc(req: Request): HydratedDocument<CustomerDocument> {
  return req.appUser!.doc as HydratedDocument<CustomerDocument>
}

// ---------- Profile menu ----------

// GET /profile/menu: everything the Profile tab shows in one call (header card, menu rows with their subtitles and
// badges, and the "Become a partner" banner). Each row's `key` tells the app which screen to open.
export async function getProfileMenu(req: Request, res: Response) {
  const customer = customerDoc(req)
  const [settings, unreadNotifications, openClaims] = await Promise.all([
    getPlatformSettings(),
    AppNotification.countDocuments({ userType: 'customer', userId: customer._id, readAt: null }),
    Ticket.countDocuments({ raisedByType: 'customer', raisedById: customer._id, category: 'claim', status: { $nin: CLOSED_TICKET_STATUSES } }),
  ])

  res.json({
    user: { id: customer.id, name: customer.name, phone: customer.phone, photoUrl: customer.photoUrl ?? null, rating: customer.rating, profileComplete: isProfileComplete(req.appUser!) },
    items: [
      { key: 'help', title: 'Help' },
      { key: 'payment', title: 'Payment' },
      { key: 'my_rides', title: 'My Rides' },
      { key: 'my_shipments', title: 'My Shipments' },
      { key: 'safety', title: 'Safety' },
      ...(settings.referralEnabled ? [{ key: 'refer_and_earn', title: 'Refer and Earn', subtitle: `Get ₹${settings.referralRewardReferrer}` }] : []),
      { key: 'my_rewards', title: 'My Rewards' },
      { key: 'coins', title: `${settings.platformName} Coins`, badge: customer.coins || null },
      { key: 'notifications', title: 'Notifications', badge: unreadNotifications || null },
      { key: 'claims', title: 'Claims', badge: openClaims || null },
      { key: 'settings', title: 'Settings' },
    ].map((item) => ({ subtitle: null, badge: null, ...item })),
    partner: { title: `Earn money with ${settings.platformName}`, subtitle: 'Become a partner', url: env.riderAppUrl || null },
  })
}

// ---------- Help ----------

const TICKET_CATEGORY_LABELS: Record<(typeof TICKET_CATEGORIES)[number], string> = {
  payment: 'Payment',
  booking: 'Booking',
  driver: 'Rider behaviour',
  vehicle: 'Vehicle',
  lost_item: 'Lost item',
  refund: 'Refund',
  cancellation: 'Cancellation',
  technical: 'App issue',
}

// GET /help: support contacts, FAQ, ticket categories for "Raise a ticket", and the latest trips to ask about.
export async function getHelp(req: Request, res: Response) {
  const customer = customerDoc(req)
  const [settings, faq, recentBookings, openTickets] = await Promise.all([
    getPlatformSettings(),
    CmsPage.findOne({ slug: 'faq' }).select('title content updatedAt'),
    Booking.find({ customer: customer._id }).select(BOOKING_BRIEF_FIELDS).sort({ createdAt: -1 }).limit(3),
    Ticket.countDocuments({ raisedByType: 'customer', raisedById: customer._id, category: { $ne: 'claim' }, status: { $nin: CLOSED_TICKET_STATUSES } }),
  ])
  res.json({
    support: { phone: settings.supportPhone, email: settings.supportEmail },
    faq: faq ? { title: faq.title, content: faq.content, updatedAt: faq.updatedAt } : null,
    ticketCategories: TICKET_CATEGORIES.map((key) => ({ key, name: TICKET_CATEGORY_LABELS[key] })),
    recentBookings,
    openTickets,
  })
}

// ---------- Safety ----------

const SAFETY_TIPS = [
  { title: 'Check before you board', description: "Match the vehicle number, the rider's photo and name with the app before starting the trip." },
  { title: 'Share your trip', description: 'Send your live trip link to family or friends from the trip screen.' },
  { title: 'Use SOS in an emergency', description: 'SOS alerts our safety team and sends your location to your emergency contacts.' },
  { title: 'Keep your OTP private', description: 'Give the start OTP to the rider only after you are in the right vehicle.' },
  { title: 'Calls stay private', description: 'Call the rider from the app. Your number is not shared.' },
]

// GET /safety: emergency contacts, the ongoing trip (for SOS and sharing) and safety tips.
export async function getSafety(req: Request, res: Response) {
  const customer = customerDoc(req)
  const [settings, ongoing] = await Promise.all([
    getPlatformSettings(),
    Booking.findOne({ customer: customer._id, status: { $in: OPEN_BOOKING_STATUSES } }).select('bookingCode mode status').sort({ createdAt: -1 }),
  ])
  res.json({
    emergencyContacts: { contacts: contactsOf(customer), max: MAX_EMERGENCY_CONTACTS },
    ongoingBooking: ongoing,
    support: { phone: settings.supportPhone },
    tips: SAFETY_TIPS,
  })
}

// ---------- Claims ----------

const CLAIM_TYPE_LABELS: Record<(typeof CLAIM_TYPES)[number], string> = {
  damaged_goods: 'Goods damaged',
  lost_goods: 'Goods lost or missing',
  overcharged: 'Charged too much',
  other: 'Something else',
}
const GOODS_CLAIMS: readonly string[] = ['damaged_goods', 'lost_goods']

function serializeClaim(ticket: InstanceType<typeof Ticket>) {
  return {
    id: ticket.id,
    type: ticket.claim?.type,
    title: CLAIM_TYPE_LABELS[ticket.claim!.type],
    description: ticket.description,
    amount: ticket.claim?.amount ?? null,
    photos: ticket.claim?.photos ?? [],
    booking: ticket.booking,
    status: ticket.status,
    notes: ticket.notes,
    resolvedAt: ticket.resolvedAt ?? null,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
  }
}

const ownClaims = (customer: HydratedDocument<CustomerDocument>) => ({ raisedByType: 'customer', raisedById: customer._id, category: 'claim' })

// GET /claims?page=&limit=: my claims, newest first, plus the claim types for the "New claim" form.
export async function listClaims(req: Request, res: Response) {
  const filter = ownClaims(customerDoc(req))
  const { page, limit, skip } = parsePagination(req)
  const [items, total] = await Promise.all([
    Ticket.find(filter).populate('booking', 'bookingCode mode status').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Ticket.countDocuments(filter),
  ])
  res.json({
    types: CLAIM_TYPES.map((key) => ({ key, name: CLAIM_TYPE_LABELS[key], transportOnly: GOODS_CLAIMS.includes(key) })),
    windowDays: CLAIM_WINDOW_DAYS,
    items: items.map(serializeClaim),
    total,
    page,
    limit,
  })
}

// GET /claims/:id
export async function getClaim(req: Request, res: Response) {
  const claim = await Ticket.findOne({ _id: requireObjectId(req.params.id, 'id'), ...ownClaims(customerDoc(req)) }).populate('booking', 'bookingCode mode status')
  if (!claim) throw new HttpError(404, 'Claim not found')
  res.json(serializeClaim(claim))
}

// POST /claims (multipart): bookingId, type, description, optional amount and photos (photo1-photo3).
// Shows up in the admin panel's Tickets list under the "Claim" category.
export async function createClaim(req: Request, res: Response) {
  const customer = customerDoc(req)
  const body = req.body as Record<string, unknown>
  const type = body.type as (typeof CLAIM_TYPES)[number]
  if (!CLAIM_TYPES.includes(type)) throw new HttpError(400, `type must be one of: ${CLAIM_TYPES.join(', ')}`)
  const description = requireString(body.description, 'description', 2000)
  const amount = body.amount === undefined || body.amount === '' ? undefined : parseAmount(body.amount, 'amount', { min: 1 })

  const booking = await Booking.findOne({ _id: requireObjectId(body.bookingId, 'bookingId'), customer: customer._id }).select('bookingCode mode status completedAt updatedAt')
  if (!booking) throw new HttpError(404, 'Booking not found')
  if (!['completed', 'cancelled'].includes(booking.status)) throw new HttpError(409, 'You can raise a claim once the booking is completed or cancelled')
  if (GOODS_CLAIMS.includes(type) && booking.mode !== 'transport') throw new HttpError(400, 'Goods claims are only for shipments')
  const endedAt = booking.completedAt ?? booking.updatedAt
  if (Date.now() - endedAt.getTime() > CLAIM_WINDOW_DAYS * 86_400_000) throw new HttpError(409, `Claims must be raised within ${CLAIM_WINDOW_DAYS} days of the trip`)
  const open = await Ticket.exists({ ...ownClaims(customer), booking: booking._id, status: { $nin: CLOSED_TICKET_STATUSES } })
  if (open) throw new HttpError(409, 'You already have an open claim for this booking')

  const files = (req.files ?? {}) as Record<string, Express.Multer.File[] | undefined>
  const photos = CLAIM_PHOTO_FIELDS.flatMap((field) => files[field] ?? []).map((file) => uploadedFileUrl('claims', file))

  const claim = await Ticket.create({
    subject: `${CLAIM_TYPE_LABELS[type]} (${booking.bookingCode})`,
    description,
    category: 'claim',
    priority: GOODS_CLAIMS.includes(type) ? 'high' : 'medium',
    raisedByType: 'customer',
    raisedById: customer._id,
    raisedByName: customer.name || customer.phone,
    booking: booking._id,
    claim: { type, amount, photos },
  })
  await claim.populate('booking', 'bookingCode mode status')
  res.status(201).json(serializeClaim(claim))
}

// ---------- Settings ----------

async function settingsResponse(customer: HydratedDocument<CustomerDocument>) {
  const s = await getPlatformSettings()
  return {
    language: customer.language,
    notifications: { tripUpdates: true, offers: customer.notificationPrefs?.offers ?? true },
    support: { phone: s.supportPhone, email: s.supportEmail },
    legal: { terms: '/api/v1/customer/terms', privacyPolicy: '/api/v1/customer/privacy-policy' },
    deletionRequestedAt: customer.deletionRequestedAt ?? null,
  }
}

// GET /settings: the Settings screen. Language names come from GET /common/app-config.
export async function getSettings(req: Request, res: Response) {
  res.json(await settingsResponse(customerDoc(req)))
}

// PATCH /settings { language?, notifications?: { offers } }: trip and payment notifications cannot be switched off.
export async function updateSettings(req: Request, res: Response) {
  const customer = customerDoc(req)
  const body = (req.body ?? {}) as { language?: unknown; notifications?: { offers?: unknown } }
  if (body.language !== undefined) {
    if (!APP_LANGUAGES.includes(body.language as (typeof APP_LANGUAGES)[number])) throw new HttpError(400, `language must be one of: ${APP_LANGUAGES.join(', ')}`)
    customer.set('language', body.language)
  }
  const offers = body.notifications?.offers
  if (offers !== undefined) {
    if (typeof offers !== 'boolean') throw new HttpError(400, 'notifications.offers must be true or false')
    customer.set('notificationPrefs.offers', offers)
  }
  await customer.save()
  res.json(await settingsResponse(customer))
}
