"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdrawOffer = exports.rejectOffer = exports.expireOffer = void 0;
exports.findNearbyRiders = findNearbyRiders;
exports.requestPayload = requestPayload;
exports.offerNext = offerNext;
exports.startDispatch = startDispatch;
exports.stopDispatch = stopDispatch;
exports.startDispatchSweeper = startDispatchSweeper;
// Matching: a requested booking is offered to one nearby eligible rider at a
// time. The rider has `riderRequestTimeoutSeconds` to accept; on reject or
// timeout the next-nearest rider gets it, up to `maxDispatchAttempts` riders.
const mongoose_1 = require("mongoose");
const Booking_1 = require("../models/Booking");
const Driver_1 = require("../models/Driver");
const Vehicle_1 = require("../models/Vehicle");
const fare_1 = require("../utils/fare");
const geo_1 = require("../utils/geo");
const notify_1 = require("../utils/notify");
const settings_1 = require("../utils/settings");
const socket_1 = require("../realtime/socket");
const geo_2 = require("../utils/geo");
/** Riders whose last location is older than this are not offered bookings. */
const LOCATION_FRESH_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 15 * 1000;
/** Riders within this distance of the pickup are offered the booking first; farther riders only after they are exhausted. */
const PREFERRED_RADIUS_KM = 0.5;
const timers = new Map();
function clearTimer(bookingId) {
    const timer = timers.get(bookingId);
    if (timer)
        clearTimeout(timer);
    timers.delete(bookingId);
}
function scheduleExpiry(bookingId, driverId, expiresAt) {
    clearTimer(bookingId);
    const timer = setTimeout(() => void (0, exports.expireOffer)(bookingId, driverId).catch(logError), Math.max(0, expiresAt.getTime() - Date.now()) + 250);
    timer.unref();
    timers.set(bookingId, timer);
}
function logError(err) {
    console.error('[dispatch]', err);
}
/** Riders who own an active vehicle in the category. */
async function vehicleOwnersFor(categoryKey) {
    return Vehicle_1.Vehicle.find({ categoryKey, status: 'active', ownerType: 'driver' }).distinct('ownerId');
}
/** Online, approved riders near a point who can serve the category, nearest first. */
async function findNearbyRiders(point, categoryKey, opts) {
    const [vehicleOwners, busyWithOffer] = await Promise.all([
        vehicleOwnersFor(categoryKey),
        Booking_1.Booking.find({ status: 'requested', 'offer.driver': { $ne: null }, 'offer.expiresAt': { $gt: new Date() } }).distinct('offer.driver'),
    ]);
    const exclude = [...(opts.exclude ?? []), ...busyWithOffer];
    const box = (0, geo_2.boundingBox)(point, opts.radiusKm);
    const riders = await Driver_1.Driver.find({
        _id: { $nin: exclude },
        'currentLocation.lat': { $gte: box.minLat, $lte: box.maxLat },
        'currentLocation.lng': { $gte: box.minLng, $lte: box.maxLng },
        status: 'active',
        approvalStatus: 'verified',
        onlineStatus: 'online',
        'currentLocation.updatedAt': { $gte: new Date(Date.now() - LOCATION_FRESH_MS) },
        // Riders pick services during onboarding; seeded/admin-created riders qualify through their vehicle.
        $or: [{ 'onboarding.services': categoryKey }, { _id: { $in: vehicleOwners } }],
    }).select('name rating currentLocation assignedVehicle');
    return riders
        .map((rider) => ({ rider, distanceKm: (0, geo_1.haversineKm)(point, { lat: rider.currentLocation.lat, lng: rider.currentLocation.lng }) }))
        .filter((r) => r.distanceKm <= opts.radiusKm)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, opts.limit ?? 20);
}
/** Booking payload shown on the rider's incoming-request screen. */
async function requestPayload(booking, distanceToPickupKm) {
    const commission = await (0, fare_1.computeCommission)(booking.categoryKey, booking.fare?.total ?? 0);
    return {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        mode: booking.mode,
        categoryKey: booking.categoryKey,
        pickup: booking.pickup,
        drop: booking.drop,
        stops: booking.stops.map((s) => ({ id: s.id, address: s.address, lat: s.lat, lng: s.lng })),
        distanceKm: booking.distanceKm,
        distanceToPickupKm: distanceToPickupKm != null ? Math.round(distanceToPickupKm * 10) / 10 : undefined,
        paymentMethod: booking.paymentMethod,
        earning: Math.round(((booking.fare?.total ?? 0) - commission) * 100) / 100,
        expiresAt: booking.offer?.expiresAt,
    };
}
async function markNoRiderFound(bookingId, note) {
    const booking = await Booking_1.Booking.findOneAndUpdate({ _id: bookingId, status: 'requested' }, { $set: { status: 'no_rider_found', offer: { driver: null } }, $push: { timeline: { status: 'no_rider_found', at: new Date(), note } } }, { new: true });
    if (!booking)
        return;
    clearTimer(bookingId);
    const event = { bookingId, status: 'no_rider_found', timestamp: new Date().toISOString() };
    (0, socket_1.emitBookingEvent)(bookingId, 'booking:status', event, ['customer', 'admin']);
    await (0, notify_1.notifyUser)('customer', booking.customer, {
        title: 'No rider found',
        body: `We couldn't find a rider for ${booking.bookingCode}. Tap to try again.`,
        data: { bookingId, type: 'no_rider_found' },
    });
}
/** Offers the booking to the next eligible rider, or marks it "no rider found". */
async function offerNext(bookingId) {
    const booking = await Booking_1.Booking.findById(bookingId);
    if (!booking || booking.status !== 'requested')
        return;
    if (booking.offer?.driver && booking.offer.expiresAt && booking.offer.expiresAt > new Date())
        return;
    const settings = await (0, settings_1.getPlatformSettings)();
    if (booking.dispatchAttempts >= settings.maxDispatchAttempts) {
        return markNoRiderFound(bookingId, 'No rider accepted after dispatch attempts');
    }
    const pickup = { lat: booking.pickup.lat, lng: booking.pickup.lng };
    // Prefer a rider within 500 m; only widen to the full dispatch radius once no nearby rider is available.
    let [candidate] = await findNearbyRiders(pickup, booking.categoryKey, { radiusKm: PREFERRED_RADIUS_KM, exclude: booking.rejectedBy, limit: 1 });
    if (!candidate && settings.dispatchRadiusKm > PREFERRED_RADIUS_KM) {
        ;
        [candidate] = await findNearbyRiders(pickup, booking.categoryKey, { radiusKm: settings.dispatchRadiusKm, exclude: booking.rejectedBy, limit: 1 });
    }
    if (!candidate) {
        return markNoRiderFound(bookingId, `No eligible online rider found within ${settings.dispatchRadiusKm} km`);
    }
    const now = new Date();
    const expiresAt = new Date(now.getTime() + settings.riderRequestTimeoutSeconds * 1000);
    // Only one offer may be live per booking; a concurrent call loses this update.
    const offered = await Booking_1.Booking.findOneAndUpdate({
        _id: bookingId,
        status: 'requested',
        $or: [{ 'offer.driver': null }, { 'offer.driver': { $exists: false } }, { 'offer.expiresAt': { $lte: now } }],
    }, { $set: { offer: { driver: candidate.rider._id, offeredAt: now, expiresAt } }, $inc: { dispatchAttempts: 1 } }, { new: true });
    if (!offered)
        return;
    scheduleExpiry(bookingId, candidate.rider.id, expiresAt);
    (0, socket_1.emitToRider)(candidate.rider._id, 'booking:request', await requestPayload(offered, candidate.distanceKm));
    await (0, notify_1.notifyUser)('driver', candidate.rider._id, {
        title: 'New booking request',
        body: `${offered.mode === 'ride' ? 'Ride' : 'Delivery'} pickup ${candidate.distanceKm.toFixed(1)} km away`,
        data: { bookingId, type: 'booking_request' },
        // A late push for an expired offer is useless.
        ttlSeconds: settings.riderRequestTimeoutSeconds,
    });
}
/** Clears the rider's offer (rejected or timed out) and moves on. Returns false if the offer was no longer theirs. */
async function releaseOffer(bookingId, driverId, note) {
    const released = await Booking_1.Booking.findOneAndUpdate({ _id: bookingId, status: 'requested', 'offer.driver': driverId }, { $set: { offer: { driver: null } }, $addToSet: { rejectedBy: new mongoose_1.Types.ObjectId(driverId) }, $push: { timeline: { status: 'requested', at: new Date(), note } } });
    if (!released)
        return false;
    clearTimer(bookingId);
    (0, socket_1.emitToRider)(driverId, 'booking:request_expired', { bookingId });
    await offerNext(bookingId);
    return true;
}
const expireOffer = (bookingId, driverId) => releaseOffer(bookingId, driverId, 'Rider did not respond');
exports.expireOffer = expireOffer;
const rejectOffer = (bookingId, driverId) => releaseOffer(bookingId, driverId, 'Rider rejected the request');
exports.rejectOffer = rejectOffer;
const withdrawOffer = (bookingId, driverId) => releaseOffer(bookingId, driverId, 'Rider account was deleted');
exports.withdrawOffer = withdrawOffer;
/** Starts (or restarts) matching for a booking that is in `requested`. */
function startDispatch(bookingId) {
    void offerNext(bookingId).catch(logError);
}
function stopDispatch(bookingId) {
    clearTimer(bookingId);
}
/**
 * Safety net run on an interval: starts scheduled bookings that are due,
 * re-offers bookings whose offer expired (e.g. after a server restart) and
 * re-arms timers for live offers this process doesn't know about.
 */
async function sweep() {
    const settings = await (0, settings_1.getPlatformSettings)();
    const now = new Date();
    const due = await Booking_1.Booking.find({ status: 'scheduled', scheduledAt: { $lte: new Date(now.getTime() + settings.scheduleLeadMinutes * 60_000) } }).select('_id');
    for (const b of due) {
        const started = await Booking_1.Booking.findOneAndUpdate({ _id: b._id, status: 'scheduled' }, { $set: { status: 'requested' }, $push: { timeline: { status: 'requested', at: now, note: 'Scheduled booking: searching for a rider' } } });
        if (started) {
            (0, socket_1.emitBookingEvent)(b.id, 'booking:status', { bookingId: b.id, status: 'requested', timestamp: now.toISOString() }, ['customer', 'admin']);
            await offerNext(b.id);
        }
    }
    const searching = await Booking_1.Booking.find({ status: 'requested' }).select('_id offer');
    for (const b of searching) {
        const driverId = b.offer?.driver?.toString();
        if (!driverId)
            await offerNext(b.id);
        else if (b.offer.expiresAt <= now)
            await (0, exports.expireOffer)(b.id, driverId);
        else if (!timers.has(b.id))
            scheduleExpiry(b.id, driverId, b.offer.expiresAt);
    }
}
function startDispatchSweeper() {
    const run = () => void sweep().catch(logError);
    run();
    setInterval(run, SWEEP_INTERVAL_MS).unref();
}
//# sourceMappingURL=dispatch.js.map