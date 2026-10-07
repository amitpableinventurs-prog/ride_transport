// Socket.IO (SRS §10.6). Namespaces /customer, /rider and /admin; every client
// joins `user:<id>` and the `booking:<id>` room of its active booking.
import type { Server as HttpServer } from 'http'
import { Server, type Namespace, type Socket } from 'socket.io'
import { env } from '../config/env'
import { Admin } from '../models/Admin'
import { Booking, ACTIVE_TRIP_STATUSES, OPEN_BOOKING_STATUSES } from '../models/Booking'
import { ChatMessage } from '../models/ChatMessage'
import { Driver } from '../models/Driver'
import { ServiceArea } from '../models/ServiceArea'
import { findAppUserById, isAppUserActive, type AppUser } from '../utils/appUsers'
import { etaMinutes, haversineKm, parseLatLng, type LatLng } from '../utils/geo'
import { verifyAccessToken, verifyAppAccessToken, type AppUserType } from '../utils/jwt'
import { isSessionRevoked } from '../utils/sessions'

type Target = 'customer' | 'rider' | 'admin'
type Id = { toString(): string }

let io: Server | null = null

const LOCATION_DB_WRITE_MS = 3_000
const LIVE_RIDERS_BATCH_MS = 5_000
const LIVE_RIDER_STALE_MS = 60_000
const AREA_CACHE_MS = 60_000
const CHAT_MAX_LENGTH = 1000

const ns = (target: Target): Namespace | null => io?.of(`/${target}`) ?? null

// ---------- Emit helpers used by controllers and the dispatcher ----------

export function emitToCustomer(customerId: Id, event: string, payload: unknown) {
  ns('customer')?.to(`user:${customerId.toString()}`).emit(event, payload)
}

export function emitToRider(driverId: Id, event: string, payload: unknown) {
  ns('rider')?.to(`user:${driverId.toString()}`).emit(event, payload)
}

export function emitToAdmins(event: string, payload: unknown) {
  ns('admin')?.to('admins').emit(event, payload)
}

/** Emits to the booking room in each target namespace (admins get every booking event). */
export function emitBookingEvent(bookingId: Id, event: string, payload: unknown, targets: Target[]) {
  for (const target of targets) {
    if (target === 'admin') emitToAdmins(event, payload)
    else ns(target)?.to(`booking:${bookingId.toString()}`).emit(event, payload)
  }
}

/** Puts the customer's and rider's connected sockets into the booking room. */
export function joinBookingRoom(bookingId: Id, people: { customerId?: Id | null; driverId?: Id | null }) {
  const room = `booking:${bookingId.toString()}`
  if (people.customerId) ns('customer')?.in(`user:${people.customerId.toString()}`).socketsJoin(room)
  if (people.driverId) ns('rider')?.in(`user:${people.driverId.toString()}`).socketsJoin(room)
}

export function leaveBookingRoom(bookingId: Id, people: { driverId?: Id | null } = {}) {
  const room = `booking:${bookingId.toString()}`
  if (people.driverId) {
    ns('rider')?.in(`user:${people.driverId.toString()}`).socketsLeave(room)
    return
  }
  ns('customer')?.in(room).socketsLeave(room)
  ns('rider')?.in(room).socketsLeave(room)
}

// ---------- Auth ----------

function handshakeToken(socket: Socket): string | null {
  const fromAuth = (socket.handshake.auth as { token?: unknown })?.token
  if (typeof fromAuth === 'string' && fromAuth) return fromAuth.replace(/^Bearer /, '')
  const header = socket.handshake.headers.authorization
  return header?.startsWith('Bearer ') ? header.slice(7) : null
}

function appAuth(userType: AppUserType) {
  return async (socket: Socket, next: (err?: Error) => void) => {
    const token = handshakeToken(socket)
    const payload = token ? verifyAppAccessToken(token) : null
    if (!payload || payload.ut !== userType || (await isSessionRevoked(payload.fid))) return next(new Error('Unauthorized'))
    const user = await findAppUserById(payload.ut, payload.sub)
    if (!user || !isAppUserActive(user)) return next(new Error('Unauthorized'))
    socket.data.user = user
    next()
  }
}

async function adminAuth(socket: Socket, next: (err?: Error) => void) {
  const token = handshakeToken(socket)
  const payload = token ? verifyAccessToken(token) : null
  if (payload && (await isSessionRevoked(payload.fid))) return next(new Error('Unauthorized'))
  const admin = payload ? await Admin.findById(payload.sub).select('status') : null
  if (!admin || admin.status === 'suspended') return next(new Error('Unauthorized'))
  next()
}

// ---------- Live rider positions ----------

interface LiveRider {
  id: string
  name: string
  lat: number
  lng: number
  heading?: number
  speed?: number
  onlineStatus: string
  updatedAt: number
}

const liveRiders = new Map<string, LiveRider>()
let areaCache: { at: number; areas: { id: string; name: string; center: LatLng; radiusKm: number }[] } = { at: 0, areas: [] }

async function serviceAreas() {
  if (Date.now() - areaCache.at > AREA_CACHE_MS) {
    const areas = await ServiceArea.find({ status: 'active' }).select('name geofence')
    areaCache = {
      at: Date.now(),
      areas: areas
        .filter((a) => a.geofence?.centerLat != null && a.geofence?.centerLng != null && a.geofence?.radiusKm != null)
        .map((a) => ({
          id: a.id as string,
          name: a.name,
          center: { lat: a.geofence!.centerLat!, lng: a.geofence!.centerLng! },
          radiusKm: a.geofence!.radiusKm!,
        })),
    }
  }
  return areaCache.areas
}

export function removeLiveRider(driverId: Id) {
  liveRiders.delete(driverId.toString())
}

// admin:live_riders — batched rider positions per zone.
async function broadcastLiveRiders() {
  const adminNs = ns('admin')
  if (!adminNs || adminNs.sockets.size === 0) return
  const now = Date.now()
  const areas = await serviceAreas()
  const byZone = new Map<string, { zoneId: string | null; zoneName: string; riders: LiveRider[] }>()
  for (const [id, rider] of liveRiders) {
    if (now - rider.updatedAt > LIVE_RIDER_STALE_MS) {
      liveRiders.delete(id)
      continue
    }
    const area = areas.find((a) => haversineKm(rider, a.center) <= a.radiusKm)
    const key = area?.id ?? 'unzoned'
    if (!byZone.has(key)) byZone.set(key, { zoneId: area?.id ?? null, zoneName: area?.name ?? 'Outside service areas', riders: [] })
    byZone.get(key)!.riders.push(rider)
  }
  for (const zone of byZone.values()) {
    adminNs.to('admins').emit('admin:live_riders', {
      zoneId: zone.zoneId,
      zoneName: zone.zoneName,
      riders: zone.riders.map((r) => ({ ...r, updatedAt: new Date(r.updatedAt).toISOString() })),
    })
  }
}

// ---------- Connection handlers ----------

async function joinActiveBookings(socket: Socket, field: 'customer' | 'driver', userId: string) {
  const statuses = field === 'customer' ? OPEN_BOOKING_STATUSES : ACTIVE_TRIP_STATUSES
  const bookings = await Booking.find({ [field]: userId, status: { $in: statuses } }).select('_id')
  for (const b of bookings) socket.join(`booking:${b.id}`)
}

type Ack = ((response: unknown) => void) | undefined

const CHAT_MIN_INTERVAL_MS = 500

/** Socket handlers are async; log failures instead of leaving unhandled rejections. */
function safe<A extends unknown[]>(handler: (...args: A) => Promise<unknown>) {
  return (...args: A) => {
    handler(...args).catch((err) => console.error('[realtime]', err))
  }
}

function registerChat(socket: Socket, from: 'customer' | 'driver') {
  let lastChatAt = 0
  socket.on('chat:message', safe(async (payload: { bookingId?: unknown; text?: unknown }, ack: Ack) => {
    if (Date.now() - lastChatAt < CHAT_MIN_INTERVAL_MS) return ack?.({ ok: false, message: 'You are sending messages too fast' })
    lastChatAt = Date.now()
    const user = socket.data.user as AppUser
    const text = typeof payload?.text === 'string' ? payload.text.trim().slice(0, CHAT_MAX_LENGTH) : ''
    const bookingId = typeof payload?.bookingId === 'string' ? payload.bookingId : ''
    if (!text || !/^[a-f\d]{24}$/i.test(bookingId)) return ack?.({ ok: false, message: 'bookingId and text are required' })

    const booking = await Booking.findOne({ _id: bookingId, [from]: user.doc._id, status: { $in: ACTIVE_TRIP_STATUSES } }).select('_id')
    if (!booking) return ack?.({ ok: false, message: 'Chat is only available during an active trip' })

    const message = await ChatMessage.create({ booking: booking._id, from, senderId: user.doc._id, text })
    const event = { bookingId, text, from, sentAt: message.createdAt.toISOString() }
    emitBookingEvent(bookingId, 'chat:message', event, ['customer', 'rider'])
    ack?.({ ok: true, message: event })
  }))
}

function registerBookingJoin(socket: Socket, field: 'customer' | 'driver') {
  // Lets an app re-join a booking room explicitly (e.g. after opening a booking from history).
  socket.on('booking:join', safe(async (payload: { bookingId?: unknown }, ack: Ack) => {
    const user = socket.data.user as AppUser
    const bookingId = typeof payload?.bookingId === 'string' ? payload.bookingId : ''
    const booking = /^[a-f\d]{24}$/i.test(bookingId) ? await Booking.exists({ _id: bookingId, [field]: user.doc._id }) : null
    if (!booking) return ack?.({ ok: false, message: 'Booking not found' })
    socket.join(`booking:${bookingId}`)
    ack?.({ ok: true })
  }))
}

function onCustomerConnection(socket: Socket) {
  const user = socket.data.user as AppUser
  socket.join(`user:${user.doc.id}`)
  void joinActiveBookings(socket, 'customer', user.doc.id)
  registerChat(socket, 'customer')
  registerBookingJoin(socket, 'customer')
}

const LOCATION_MIN_INTERVAL_MS = 1000
const RIDER_STATE_CACHE_MS = 5000

function findActiveTrip(driverId: string) {
  return Booking.findOne({ driver: driverId, status: { $in: ACTIVE_TRIP_STATUSES } }).select('status pickup drop stops')
}

function onRiderConnection(socket: Socket) {
  const user = socket.data.user as AppUser
  const driverId = user.doc.id as string
  socket.join(`user:${driverId}`)
  void joinActiveBookings(socket, 'driver', driverId)
  registerChat(socket, 'driver')
  registerBookingJoin(socket, 'driver')

  let lastDbWrite = 0
  let lastEventAt = 0
  // Rider status and active trip are cached per connection, so a location update (every few seconds per rider)
  // does not need two database reads each time.
  let driverCache: { at: number; name: string; onlineStatus: string } | null = null
  let bookingCache: { at: number; value: Awaited<ReturnType<typeof findActiveTrip>> } | null = null
  socket.on('rider:location', safe(async (payload: { lat?: unknown; lng?: unknown; heading?: unknown; speed?: unknown; timestamp?: unknown }) => {
    const nowMs = Date.now()
    if (nowMs - lastEventAt < LOCATION_MIN_INTERVAL_MS) return // faster than once a second adds nothing
    lastEventAt = nowMs
    const point = parseLatLng(payload?.lat, payload?.lng)
    if (!point) return
    const heading = typeof payload?.heading === 'number' ? payload.heading : undefined
    const speed = typeof payload?.speed === 'number' ? payload.speed : undefined
    const now = Date.now()

    if (!driverCache || now - driverCache.at > RIDER_STATE_CACHE_MS) {
      const found = await Driver.findById(driverId).select('name onlineStatus')
      driverCache = found ? { at: now, name: found.name, onlineStatus: found.onlineStatus } : null
    }
    const driver = driverCache
    if (!driver || driver.onlineStatus === 'offline') return

    liveRiders.set(driverId, { id: driverId, name: driver.name, ...point, heading, speed, onlineStatus: driver.onlineStatus, updatedAt: now })

    if (now - lastDbWrite >= LOCATION_DB_WRITE_MS) {
      lastDbWrite = now
      await Driver.updateOne({ _id: driverId }, { currentLocation: { ...point, heading, speed, updatedAt: new Date(now) } })
    }

    if (!bookingCache || now - bookingCache.at > RIDER_STATE_CACHE_MS) bookingCache = { at: now, value: await findActiveTrip(driverId) }
    const booking = bookingCache.value
    if (!booking) return
    const beforePickup = ['accepted', 'arriving', 'arrived'].includes(booking.status)
    const nextStop = booking.stops.find((s) => s.status === 'pending')
    const target = beforePickup ? booking.pickup : nextStop ?? booking.drop
    const etaMin = target?.lat != null && target?.lng != null ? etaMinutes(point, { lat: target.lat, lng: target.lng }) : null
    emitBookingEvent(booking.id, 'booking:rider_location', { bookingId: booking.id, ...point, heading, etaMin }, ['customer'])
  }))
}

function onAdminConnection(socket: Socket) {
  socket.join('admins')
}

export function initRealtime(httpServer: HttpServer) {
  io = new Server(httpServer, {
    cors: { origin: env.corsOrigin },
    // Small messages only (locations, chat): a huge payload cannot be used to exhaust memory.
    maxHttpBufferSize: 100_000,
    connectTimeout: 10_000,
    pingInterval: 25_000,
    pingTimeout: 20_000,
  })

  io.of('/customer').use(appAuth('customer')).on('connection', onCustomerConnection)
  io.of('/rider').use(appAuth('driver')).on('connection', onRiderConnection)
  io.of('/admin').use(adminAuth).on('connection', onAdminConnection)

  setInterval(() => void broadcastLiveRiders().catch((err) => console.error('[realtime] live riders', err)), LIVE_RIDERS_BATCH_MS).unref()
  return io
}
