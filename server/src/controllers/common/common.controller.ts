// Common app APIs (/api/v1/common) and public pages (/api/v1/public).
import type { Request, Response } from 'express'
import PDFDocument from 'pdfkit'
import { Booking, OPEN_BOOKING_STATUSES } from '../../models/Booking'
import { CmsPage } from '../../models/CmsPage'
import { Customer } from '../../models/Customer'
import { Device } from '../../models/Device'
import { Driver } from '../../models/Driver'
import { ServiceCategory } from '../../models/ServiceCategory'
import { Vehicle } from '../../models/Vehicle'
import { HttpError, optionalString, requireString } from '../../utils/http'
import { verifyInvoiceToken } from '../../utils/jwt'
import { getPlatformSettings } from '../../utils/settings'
import { etaMinutes } from '../../utils/geo'

/** A shared tracking link keeps working this long after the trip ends. */
const SHARE_GRACE_MS = 60 * 60 * 1000

// GET /common/app-config?app=customer|rider
export async function getAppConfig(req: Request, res: Response) {
  const app = req.query.app === 'rider' ? 'rider' : 'customer'
  const s = await getPlatformSettings()
  res.json({
    app,
    platformName: s.platformName,
    minVersion: app === 'rider' ? s.riderAppMinVersion : s.customerAppMinVersion,
    maintenanceMode: s.maintenanceMode,
    features: { ride: s.rideServiceEnabled, transport: s.transportServiceEnabled },
    support: { phone: s.supportPhone, email: s.supportEmail },
    currency: s.defaultCurrency,
    riderRequestTimeoutSeconds: s.riderRequestTimeoutSeconds,
  })
}

// GET /common/cms/:slug
export async function getCmsPage(req: Request, res: Response) {
  const page = await CmsPage.findOne({ slug: req.params.slug }).select('slug title content updatedAt')
  if (!page) throw new HttpError(404, 'Page not found')
  res.json(page)
}

// POST /common/devices: register (or move) an FCM token to the logged-in user.
export async function registerDevice(req: Request, res: Response) {
  const user = req.appUser!
  const body = req.body as Record<string, unknown>
  const token = requireString(body.token, 'token', 4096)
  const platform = body.platform ?? 'android'
  if (!['android', 'ios', 'web'].includes(platform as string)) throw new HttpError(400, 'platform must be android, ios or web')

  const device = await Device.findOneAndUpdate(
    { token },
    { token, userType: user.type, userId: user.doc._id, platform, appVersion: optionalString(body.appVersion, 20), lastSeenAt: new Date() },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  res.status(201).json({ id: device.id, platform: device.platform })
}

// GET /public/track/:token: data for the shared live-tracking page (no login).
export async function publicTrack(req: Request, res: Response) {
  const booking = await Booking.findOne({ shareToken: req.params.token })
  const ended = booking && !OPEN_BOOKING_STATUSES.includes(booking.status)
  const endedAt = booking?.completedAt ?? booking?.updatedAt
  if (!booking || (ended && endedAt && Date.now() - endedAt.getTime() > SHARE_GRACE_MS)) throw new HttpError(404, 'This tracking link has expired')

  const [driver, vehicle, customer] = await Promise.all([
    booking.driver ? Driver.findById(booking.driver).select('name rating currentLocation') : null,
    booking.vehicle ? Vehicle.findById(booking.vehicle).select('registrationNumber model') : null,
    Customer.findById(booking.customer).select('name'),
  ])
  const loc = !ended && driver?.currentLocation?.lat != null ? driver.currentLocation : null
  const beforePickup = ['accepted', 'arriving', 'arrived'].includes(booking.status)
  const target = beforePickup ? booking.pickup : booking.drop

  res.json({
    bookingCode: booking.bookingCode,
    status: booking.status,
    mode: booking.mode,
    // First names only on the public page.
    customerName: customer?.name?.split(' ')[0] ?? null,
    pickup: { address: booking.pickup?.address, lat: booking.pickup?.lat, lng: booking.pickup?.lng },
    drop: { address: booking.drop?.address, lat: booking.drop?.lat, lng: booking.drop?.lng },
    rider: driver ? { name: driver.name.split(' ')[0], rating: driver.rating } : null,
    vehicle: vehicle ? { registrationNumber: vehicle.registrationNumber, model: vehicle.model } : null,
    location: loc ? { lat: loc.lat, lng: loc.lng, heading: loc.heading, updatedAt: loc.updatedAt } : null,
    etaMin: loc && target?.lat != null ? etaMinutes({ lat: loc.lat!, lng: loc.lng! }, { lat: target.lat, lng: target.lng! }) : null,
  })
}

// GET /public/invoices/:token: invoice PDF for a completed booking.
export async function publicInvoice(req: Request, res: Response) {
  const bookingId = verifyInvoiceToken(String(req.params.token))
  const booking = bookingId ? await Booking.findOne({ _id: bookingId, status: 'completed' }) : null
  if (!booking) throw new HttpError(404, 'This invoice link is invalid or has expired')

  const [settings, customer, driver, vehicle, category] = await Promise.all([
    getPlatformSettings(),
    Customer.findById(booking.customer).select('name phone email'),
    booking.driver ? Driver.findById(booking.driver).select('name') : null,
    booking.vehicle ? Vehicle.findById(booking.vehicle).select('registrationNumber') : null,
    ServiceCategory.findOne({ key: booking.categoryKey }).select('name'),
  ])

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `inline; filename="invoice-${booking.bookingCode}.pdf"`)
  const pdf = new PDFDocument({ size: 'A4', margin: 50 })
  pdf.pipe(res)

  const money = (n: number | null | undefined) => `INR ${(n ?? 0).toFixed(2)}`
  const date = (d?: Date | null) => (d ? d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-')

  pdf.fontSize(20).text(settings.platformName, { continued: false })
  pdf.fontSize(10).fillColor('#555').text(`${settings.supportEmail} · ${settings.supportPhone}`)
  pdf.moveDown().fillColor('#000').fontSize(14).text('Trip invoice')
  pdf.fontSize(10)
  pdf.text(`Invoice no: INV-${booking.bookingCode}`)
  pdf.text(`Booking: ${booking.bookingCode} (${booking.mode === 'ride' ? 'Ride' : 'Transport'} · ${category?.name ?? booking.categoryKey})`)
  pdf.text(`Trip date: ${date(booking.startedAt ?? booking.createdAt)} — ${date(booking.completedAt)}`)
  pdf.moveDown()
  pdf.text(`Customer: ${customer?.name || '-'} (${customer?.phone ?? ''})`)
  pdf.text(`Rider: ${driver?.name || '-'}${vehicle ? ` · ${vehicle.registrationNumber}` : ''}`)
  pdf.moveDown()
  pdf.text(`From: ${booking.pickup?.address ?? `${booking.pickup?.lat}, ${booking.pickup?.lng}`}`)
  if (booking.mode === 'transport') booking.stops.forEach((s, i) => pdf.text(`Drop ${i + 1}: ${s.address ?? `${s.lat}, ${s.lng}`}`))
  else pdf.text(`To: ${booking.drop?.address ?? `${booking.drop?.lat}, ${booking.drop?.lng}`}`)
  pdf.text(`Distance: ${booking.distanceKm} km`)
  pdf.moveDown()

  const f = booking.fare!
  const rows: [string, number][] = [
    ['Base fare', f.base],
    ['Distance', f.distance],
    ['Time', f.time],
    ['Waiting', f.waiting],
    ['Night charge', f.night],
    ['Additional stops', f.extraStops],
    ['Loading / unloading', f.loading],
    ['Platform fee', f.platformFee],
    ['Taxes', f.tax],
    ['Discount', -f.discount],
  ]
  for (const [label, amount] of rows.filter(([, a]) => a !== 0)) pdf.text(label, 50, pdf.y, { continued: true, width: 300 }).text(money(amount), { align: 'right' })
  pdf.moveDown(0.5).fontSize(12).text('Total', 50, pdf.y, { continued: true, width: 300 }).text(money(f.total), { align: 'right' })
  if (f.tip) pdf.fontSize(10).text('Tip to rider', 50, pdf.y, { continued: true, width: 300 }).text(money(f.tip), { align: 'right' })
  pdf.moveDown().fontSize(10).text(`Payment: ${booking.paymentMethod.toUpperCase()} · ${booking.paymentStatus}`)
  pdf.end()
}
