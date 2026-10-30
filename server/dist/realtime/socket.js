"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.emitToCustomer = emitToCustomer;
exports.emitToRider = emitToRider;
exports.emitToAdmins = emitToAdmins;
exports.emitBookingEvent = emitBookingEvent;
exports.joinBookingRoom = joinBookingRoom;
exports.leaveBookingRoom = leaveBookingRoom;
exports.removeLiveRider = removeLiveRider;
exports.disconnectCustomer = disconnectCustomer;
exports.disconnectRider = disconnectRider;
exports.initRealtime = initRealtime;
const socket_io_1 = require("socket.io");
const env_1 = require("../config/env");
const Admin_1 = require("../models/Admin");
const Booking_1 = require("../models/Booking");
const ChatMessage_1 = require("../models/ChatMessage");
const Driver_1 = require("../models/Driver");
const ServiceArea_1 = require("../models/ServiceArea");
const appUsers_1 = require("../utils/appUsers");
const geo_1 = require("../utils/geo");
const jwt_1 = require("../utils/jwt");
const sessions_1 = require("../utils/sessions");
let io = null;
const LOCATION_DB_WRITE_MS = 3_000;
const LIVE_RIDERS_BATCH_MS = 5_000;
const LIVE_RIDER_STALE_MS = 60_000;
const AREA_CACHE_MS = 60_000;
const CHAT_MAX_LENGTH = 1000;
const ns = (target) => io?.of(`/${target}`) ?? null;
// ---------- Emit helpers used by controllers and the dispatcher ----------
function emitToCustomer(customerId, event, payload) {
    ns('customer')?.to(`user:${customerId.toString()}`).emit(event, payload);
}
function emitToRider(driverId, event, payload) {
    ns('rider')?.to(`user:${driverId.toString()}`).emit(event, payload);
}
function emitToAdmins(event, payload) {
    ns('admin')?.to('admins').emit(event, payload);
}
/** Emits to the booking room in each target namespace (admins get every booking event). */
function emitBookingEvent(bookingId, event, payload, targets) {
    for (const target of targets) {
        if (target === 'admin')
            emitToAdmins(event, payload);
        else
            ns(target)?.to(`booking:${bookingId.toString()}`).emit(event, payload);
    }
}
/** Puts the customer's and rider's connected sockets into the booking room. */
function joinBookingRoom(bookingId, people) {
    const room = `booking:${bookingId.toString()}`;
    if (people.customerId)
        ns('customer')?.in(`user:${people.customerId.toString()}`).socketsJoin(room);
    if (people.driverId)
        ns('rider')?.in(`user:${people.driverId.toString()}`).socketsJoin(room);
}
function leaveBookingRoom(bookingId, people = {}) {
    const room = `booking:${bookingId.toString()}`;
    if (people.driverId) {
        ns('rider')?.in(`user:${people.driverId.toString()}`).socketsLeave(room);
        return;
    }
    ns('customer')?.in(room).socketsLeave(room);
    ns('rider')?.in(room).socketsLeave(room);
}
// ---------- Auth ----------
function handshakeToken(socket) {
    const fromAuth = socket.handshake.auth?.token;
    if (typeof fromAuth === 'string' && fromAuth)
        return fromAuth.replace(/^Bearer /, '');
    const header = socket.handshake.headers.authorization;
    return header?.startsWith('Bearer ') ? header.slice(7) : null;
}
function appAuth(userType) {
    return async (socket, next) => {
        const token = handshakeToken(socket);
        const payload = token ? (0, jwt_1.verifyAppAccessToken)(token) : null;
        if (!payload || payload.ut !== userType || (await (0, sessions_1.isSessionRevoked)(payload.fid)))
            return next(new Error('Unauthorized'));
        const user = await (0, appUsers_1.findAppUserById)(payload.ut, payload.sub);
        if (!user || !(0, appUsers_1.isAppUserActive)(user))
            return next(new Error('Unauthorized'));
        socket.data.user = user;
        next();
    };
}
async function adminAuth(socket, next) {
    const token = handshakeToken(socket);
    const payload = token ? (0, jwt_1.verifyAccessToken)(token) : null;
    if (payload && (await (0, sessions_1.isSessionRevoked)(payload.fid)))
        return next(new Error('Unauthorized'));
    const admin = payload ? await Admin_1.Admin.findById(payload.sub).select('status') : null;
    if (!admin || admin.status === 'suspended')
        return next(new Error('Unauthorized'));
    next();
}
const liveRiders = new Map();
let areaCache = { at: 0, areas: [] };
async function serviceAreas() {
    if (Date.now() - areaCache.at > AREA_CACHE_MS) {
        const areas = await ServiceArea_1.ServiceArea.find({ status: 'active' }).select('name geofence');
        areaCache = {
            at: Date.now(),
            areas: areas
                .filter((a) => a.geofence?.centerLat != null && a.geofence?.centerLng != null && a.geofence?.radiusKm != null)
                .map((a) => ({
                id: a.id,
                name: a.name,
                center: { lat: a.geofence.centerLat, lng: a.geofence.centerLng },
                radiusKm: a.geofence.radiusKm,
            })),
        };
    }
    return areaCache.areas;
}
function removeLiveRider(driverId) {
    liveRiders.delete(driverId.toString());
}
/** Signs a deleted customer's connected app out of real-time updates. */
function disconnectCustomer(customerId) {
    ns('customer')?.in(`user:${customerId.toString()}`).disconnectSockets(true);
}
/** Signs a deleted rider's connected app out of real-time updates. */
function disconnectRider(driverId) {
    ns('rider')?.in(`user:${driverId.toString()}`).disconnectSockets(true);
}
// admin:live_riders — batched rider positions per zone.
async function broadcastLiveRiders() {
    const adminNs = ns('admin');
    if (!adminNs || adminNs.sockets.size === 0)
        return;
    const now = Date.now();
    const areas = await serviceAreas();
    const byZone = new Map();
    for (const [id, rider] of liveRiders) {
        if (now - rider.updatedAt > LIVE_RIDER_STALE_MS) {
            liveRiders.delete(id);
            continue;
        }
        const area = areas.find((a) => (0, geo_1.haversineKm)(rider, a.center) <= a.radiusKm);
        const key = area?.id ?? 'unzoned';
        if (!byZone.has(key))
            byZone.set(key, { zoneId: area?.id ?? null, zoneName: area?.name ?? 'Outside service areas', riders: [] });
        byZone.get(key).riders.push(rider);
    }
    for (const zone of byZone.values()) {
        adminNs.to('admins').emit('admin:live_riders', {
            zoneId: zone.zoneId,
            zoneName: zone.zoneName,
            riders: zone.riders.map((r) => ({ ...r, updatedAt: new Date(r.updatedAt).toISOString() })),
        });
    }
}
// ---------- Connection handlers ----------
async function joinActiveBookings(socket, field, userId) {
    const statuses = field === 'customer' ? Booking_1.OPEN_BOOKING_STATUSES : Booking_1.ACTIVE_TRIP_STATUSES;
    const bookings = await Booking_1.Booking.find({ [field]: userId, status: { $in: statuses } }).select('_id');
    for (const b of bookings)
        socket.join(`booking:${b.id}`);
}
const CHAT_MIN_INTERVAL_MS = 500;
/** Socket handlers are async; log failures instead of leaving unhandled rejections. */
function safe(handler) {
    return (...args) => {
        handler(...args).catch((err) => console.error('[realtime]', err));
    };
}
function registerChat(socket, from) {
    let lastChatAt = 0;
    socket.on('chat:message', safe(async (payload, ack) => {
        if (Date.now() - lastChatAt < CHAT_MIN_INTERVAL_MS)
            return ack?.({ ok: false, message: 'You are sending messages too fast' });
        lastChatAt = Date.now();
        const user = socket.data.user;
        const text = typeof payload?.text === 'string' ? payload.text.trim().slice(0, CHAT_MAX_LENGTH) : '';
        const bookingId = typeof payload?.bookingId === 'string' ? payload.bookingId : '';
        if (!text || !/^[a-f\d]{24}$/i.test(bookingId))
            return ack?.({ ok: false, message: 'bookingId and text are required' });
        const booking = await Booking_1.Booking.findOne({ _id: bookingId, [from]: user.doc._id, status: { $in: Booking_1.ACTIVE_TRIP_STATUSES } }).select('_id');
        if (!booking)
            return ack?.({ ok: false, message: 'Chat is only available during an active trip' });
        const message = await ChatMessage_1.ChatMessage.create({ booking: booking._id, from, senderId: user.doc._id, text });
        const event = { bookingId, text, from, sentAt: message.createdAt.toISOString() };
        emitBookingEvent(bookingId, 'chat:message', event, ['customer', 'rider']);
        ack?.({ ok: true, message: event });
    }));
}
function registerBookingJoin(socket, field) {
    // Lets an app re-join a booking room explicitly (e.g. after opening a booking from history).
    socket.on('booking:join', safe(async (payload, ack) => {
        const user = socket.data.user;
        const bookingId = typeof payload?.bookingId === 'string' ? payload.bookingId : '';
        const booking = /^[a-f\d]{24}$/i.test(bookingId) ? await Booking_1.Booking.exists({ _id: bookingId, [field]: user.doc._id }) : null;
        if (!booking)
            return ack?.({ ok: false, message: 'Booking not found' });
        socket.join(`booking:${bookingId}`);
        ack?.({ ok: true });
    }));
}
function onCustomerConnection(socket) {
    const user = socket.data.user;
    socket.join(`user:${user.doc.id}`);
    void joinActiveBookings(socket, 'customer', user.doc.id);
    registerChat(socket, 'customer');
    registerBookingJoin(socket, 'customer');
}
const LOCATION_MIN_INTERVAL_MS = 1000;
const RIDER_STATE_CACHE_MS = 5000;
function findActiveTrip(driverId) {
    return Booking_1.Booking.findOne({ driver: driverId, status: { $in: Booking_1.ACTIVE_TRIP_STATUSES } }).select('status pickup drop stops');
}
function onRiderConnection(socket) {
    const user = socket.data.user;
    const driverId = user.doc.id;
    socket.join(`user:${driverId}`);
    void joinActiveBookings(socket, 'driver', driverId);
    registerChat(socket, 'driver');
    registerBookingJoin(socket, 'driver');
    let lastDbWrite = 0;
    let lastEventAt = 0;
    // Rider status and active trip are cached per connection, so a location update (every few seconds per rider)
    // does not need two database reads each time.
    let driverCache = null;
    let bookingCache = null;
    socket.on('rider:location', safe(async (payload) => {
        const nowMs = Date.now();
        if (nowMs - lastEventAt < LOCATION_MIN_INTERVAL_MS)
            return; // faster than once a second adds nothing
        lastEventAt = nowMs;
        const point = (0, geo_1.parseLatLng)(payload?.lat, payload?.lng);
        if (!point)
            return;
        const heading = typeof payload?.heading === 'number' ? payload.heading : undefined;
        const speed = typeof payload?.speed === 'number' ? payload.speed : undefined;
        const now = Date.now();
        if (!driverCache || now - driverCache.at > RIDER_STATE_CACHE_MS) {
            const found = await Driver_1.Driver.findById(driverId).select('name onlineStatus');
            driverCache = found ? { at: now, name: found.name, onlineStatus: found.onlineStatus } : null;
        }
        const driver = driverCache;
        if (!driver || driver.onlineStatus === 'offline')
            return;
        liveRiders.set(driverId, { id: driverId, name: driver.name, ...point, heading, speed, onlineStatus: driver.onlineStatus, updatedAt: now });
        if (now - lastDbWrite >= LOCATION_DB_WRITE_MS) {
            lastDbWrite = now;
            await Driver_1.Driver.updateOne({ _id: driverId }, { currentLocation: { ...point, heading, speed, updatedAt: new Date(now) } });
        }
        if (!bookingCache || now - bookingCache.at > RIDER_STATE_CACHE_MS)
            bookingCache = { at: now, value: await findActiveTrip(driverId) };
        const booking = bookingCache.value;
        if (!booking)
            return;
        const beforePickup = ['accepted', 'arriving', 'arrived'].includes(booking.status);
        const nextStop = booking.stops.find((s) => s.status === 'pending');
        const target = beforePickup ? booking.pickup : nextStop ?? booking.drop;
        const etaMin = target?.lat != null && target?.lng != null ? (0, geo_1.etaMinutes)(point, { lat: target.lat, lng: target.lng }) : null;
        emitBookingEvent(booking.id, 'booking:rider_location', { bookingId: booking.id, ...point, heading, etaMin }, ['customer']);
    }));
}
function onAdminConnection(socket) {
    socket.join('admins');
}
function initRealtime(httpServer) {
    io = new socket_io_1.Server(httpServer, {
        cors: { origin: env_1.env.corsOrigin },
        // Small messages only (locations, chat): a huge payload cannot be used to exhaust memory.
        maxHttpBufferSize: 100_000,
        connectTimeout: 10_000,
        pingInterval: 25_000,
        pingTimeout: 20_000,
    });
    io.of('/customer').use(appAuth('customer')).on('connection', onCustomerConnection);
    io.of('/rider').use(appAuth('driver')).on('connection', onRiderConnection);
    io.of('/admin').use(adminAuth).on('connection', onAdminConnection);
    setInterval(() => void broadcastLiveRiders().catch((err) => console.error('[realtime] live riders', err)), LIVE_RIDERS_BATCH_MS).unref();
    return io;
}
//# sourceMappingURL=socket.js.map