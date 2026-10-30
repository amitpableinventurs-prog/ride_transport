"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.currentRequest = currentRequest;
exports.acceptRequest = acceptRequest;
exports.rejectRequest = rejectRequest;
exports.activeBooking = activeBooking;
exports.markArrived = markArrived;
exports.startTrip = startTrip;
exports.completeStop = completeStop;
exports.completeBooking = completeBooking;
exports.confirmCashCollected = confirmCashCollected;
exports.createPaymentQr = createPaymentQr;
exports.getPaymentQrStatus = getPaymentQrStatus;
exports.cancelByRider = cancelByRider;
exports.rateCustomer = rateCustomer;
exports.listTrips = listTrips;
exports.getEarnings = getEarnings;
const mongoose_1 = require("mongoose");
const Booking_1 = require("../../models/Booking");
const Driver_1 = require("../../models/Driver");
const Rating_1 = require("../../models/Rating");
const socket_1 = require("../../realtime/socket");
const dispatch_1 = require("../../services/dispatch");
const gatewayPayments_1 = require("../../services/gatewayPayments");
const riderDues_1 = require("../../services/riderDues");
const trips_1 = require("../../services/trips");
const http_1 = require("../../utils/http");
const maps_1 = require("../../utils/maps");
const notify_1 = require("../../utils/notify");
const settings_1 = require("../../utils/settings");
const uploads_1 = require("../../utils/uploads");
const RIDER_CANCELLABLE = ['accepted', 'arriving', 'arrived'];
const EARNINGS_DEFAULT_DAYS = 7;
function driverDoc(req) {
    return req.appUser.doc;
}
async function findOwnBooking(req) {
    const booking = await Booking_1.Booking.findOne({ _id: (0, http_1.requireObjectId)(req.params.id, 'id'), driver: driverDoc(req)._id });
    if (!booking)
        throw new http_1.HttpError(404, 'Booking not found');
    return booking;
}
async function riderView(bookingId) {
    const booking = (await Booking_1.Booking.findById(bookingId).populate('customer', trips_1.CUSTOMER_TRIP_FIELDS).populate('vehicle', trips_1.VEHICLE_PUBLIC_FIELDS));
    return (0, trips_1.serializeBooking)(booking, { viewer: 'rider' });
}
function statusEvent(booking, extra = {}) {
    (0, socket_1.emitBookingEvent)(booking.id, 'booking:status', { bookingId: booking.id, status: booking.status, timestamp: new Date().toISOString(), ...extra }, ['customer', 'admin']);
}
/** Atomically moves the rider's booking between statuses; 409 when it is not in an expected state. */
async function transition(req, from, set, note) {
    const status = set.status;
    const booking = await Booking_1.Booking.findOneAndUpdate({ _id: (0, http_1.requireObjectId)(req.params.id, 'id'), driver: driverDoc(req)._id, status: { $in: from } }, { $set: set, $push: { timeline: { status, at: new Date(), note } } }, { new: true });
    if (!booking) {
        const exists = await Booking_1.Booking.exists({ _id: req.params.id, driver: driverDoc(req)._id });
        throw new http_1.HttpError(exists ? 409 : 404, exists ? 'This action is not allowed at the current trip stage' : 'Booking not found');
    }
    return booking;
}
// ---------- Requests ----------
// GET /requests/current
async function currentRequest(req, res) {
    const booking = await Booking_1.Booking.findOne({ status: 'requested', 'offer.driver': driverDoc(req)._id, 'offer.expiresAt': { $gt: new Date() } });
    res.json({ request: booking ? await (0, dispatch_1.requestPayload)(booking) : null });
}
// POST /requests/:bookingId/accept
async function acceptRequest(req, res) {
    const driver = driverDoc(req);
    const bookingId = (0, http_1.requireObjectId)(req.params.bookingId, 'bookingId');
    // Claim the rider first so they can never hold two trips.
    const claimed = await Driver_1.Driver.findOneAndUpdate({ _id: driver._id, onlineStatus: 'online' }, { onlineStatus: 'on_trip' });
    if (!claimed)
        throw new http_1.HttpError(409, 'Go online to accept requests');
    const vehicle = await (0, trips_1.activeVehicleFor)(driver._id, driver.assignedVehicle);
    const now = new Date();
    const booking = await Booking_1.Booking.findOneAndUpdate({ _id: bookingId, status: 'requested', 'offer.driver': driver._id, 'offer.expiresAt': { $gt: now } }, {
        $set: { status: 'accepted', driver: driver._id, vehicle: vehicle?._id ?? null, partner: driver.onboarding?.partner ?? null, acceptedAt: now, offer: { driver: null } },
        $push: { timeline: { status: 'accepted', at: now, note: `Accepted by ${driver.name || driver.phone}` } },
    }, { new: true });
    if (!booking) {
        await Driver_1.Driver.updateOne({ _id: driver._id, onlineStatus: 'on_trip' }, { onlineStatus: 'online' });
        throw new http_1.HttpError(409, 'This request is no longer available');
    }
    (0, dispatch_1.stopDispatch)(booking.id);
    (0, socket_1.joinBookingRoom)(booking.id, { customerId: booking.customer, driverId: driver._id });
    const loc = driver.currentLocation;
    const etaMin = loc?.lat != null && loc.lng != null ? await (0, maps_1.roadEtaMinutes)({ lat: loc.lat, lng: loc.lng }, { lat: booking.pickup.lat, lng: booking.pickup.lng }) : null;
    (0, socket_1.emitBookingEvent)(booking.id, 'booking:rider_assigned', {
        bookingId: booking.id,
        rider: { id: driver.id, name: driver.name, rating: driver.rating, photoUrl: driver.photoUrl },
        vehicle: vehicle ? { registrationNumber: vehicle.registrationNumber, model: vehicle.model, manufacturer: vehicle.manufacturer } : null,
        etaMin,
    }, ['customer']);
    statusEvent(booking);
    await (0, notify_1.notifyUser)('customer', booking.customer, {
        title: 'Rider assigned',
        body: `${driver.name || 'Your rider'} is on the way${vehicle ? ` in ${vehicle.registrationNumber}` : ''}`,
        data: { bookingId: booking.id, type: 'rider_assigned' },
    });
    res.json(await riderView(booking.id));
}
// POST /requests/:bookingId/reject
async function rejectRequest(req, res) {
    const bookingId = (0, http_1.requireObjectId)(req.params.bookingId, 'bookingId').toString();
    const released = await (0, dispatch_1.rejectOffer)(bookingId, driverDoc(req).id);
    if (!released)
        throw new http_1.HttpError(409, 'This request is no longer available');
    res.status(204).send();
}
// ---------- Trip ----------
// GET /bookings/active
async function activeBooking(req, res) {
    const booking = await Booking_1.Booking.findOne({ driver: driverDoc(req)._id, status: { $in: Booking_1.ACTIVE_TRIP_STATUSES } }).select('_id');
    res.json({ booking: booking ? await riderView(booking.id) : null });
}
// POST /bookings/:id/arrived
async function markArrived(req, res) {
    const booking = await transition(req, ['accepted', 'arriving'], { status: 'arrived', arrivedAt: new Date() }, 'Rider arrived at pickup');
    statusEvent(booking);
    await (0, notify_1.notifyUser)('customer', booking.customer, { title: 'Your rider has arrived', body: `Share OTP ${booking.startOtp} to start the trip`, data: { bookingId: booking.id, type: 'rider_arrived' } });
    res.json(await riderView(booking.id));
}
// POST /bookings/:id/start (multipart for transport: otp + goodsPhoto)
async function startTrip(req, res) {
    const current = await findOwnBooking(req);
    if (current.status !== 'arrived')
        throw new http_1.HttpError(409, 'Mark yourself arrived at the pickup first');
    if ((0, http_1.requireString)((req.body ?? {}).otp, 'otp', 10) !== current.startOtp)
        throw new http_1.HttpError(400, 'Incorrect OTP');
    if (current.mode === 'transport' && !req.file)
        throw new http_1.HttpError(400, 'goodsPhoto is required for transport pickups');
    const set = { status: current.mode === 'transport' ? 'in_transit' : 'started', startedAt: new Date() };
    if (req.file)
        set.goodsPhotoUrl = (0, uploads_1.uploadedFileUrl)('goods', req.file);
    const booking = await transition(req, ['arrived'], set, current.mode === 'transport' ? 'Goods picked up' : 'Trip started');
    statusEvent(booking);
    res.json(await riderView(booking.id));
}
// POST /bookings/:id/stops/:stopId/complete (multipart: otp + pod)
async function completeStop(req, res) {
    const booking = await findOwnBooking(req);
    if (booking.mode !== 'transport' || booking.status !== 'in_transit')
        throw new http_1.HttpError(409, 'Drops can be completed only during a transport trip');
    const stop = booking.stops.id((0, http_1.requireObjectId)(req.params.stopId, 'stopId'));
    if (!stop)
        throw new http_1.HttpError(404, 'Drop not found');
    if (stop.status === 'completed')
        throw new http_1.HttpError(409, 'This drop is already completed');
    if ((0, http_1.requireString)((req.body ?? {}).otp, 'otp', 10) !== stop.otp)
        throw new http_1.HttpError(400, 'Incorrect OTP');
    if (!req.file)
        throw new http_1.HttpError(400, 'pod (proof of delivery photo) is required');
    // Positional update so concurrent requests cannot complete the same drop twice.
    const updated = await Booking_1.Booking.findOneAndUpdate({ _id: booking._id, status: 'in_transit', stops: { $elemMatch: { _id: stop._id, status: 'pending' } } }, {
        $set: { 'stops.$.status': 'completed', 'stops.$.completedAt': new Date(), 'stops.$.podUrl': (0, uploads_1.uploadedFileUrl)('pod', req.file) },
        $push: { timeline: { status: 'in_transit', at: new Date(), note: `Delivered at ${stop.address ?? 'drop'}` } },
    }, { new: true });
    if (!updated)
        throw new http_1.HttpError(409, 'This drop is already completed');
    statusEvent(updated, { stopId: stop.id, stopStatus: 'completed' });
    res.json(await riderView(updated.id));
}
// POST /bookings/:id/complete: ends the trip and returns the final fare.
async function completeBooking(req, res) {
    const booking = await findOwnBooking(req);
    if (booking.mode === 'transport' && booking.stops.some((s) => s.status !== 'completed'))
        throw new http_1.HttpError(409, 'Complete every drop before ending the trip');
    const settings = await (0, settings_1.getPlatformSettings)();
    const completed = (await (0, trips_1.completeTrip)(booking.id, driverDoc(req)._id, settings.freeWaitingMinutes));
    (0, socket_1.leaveBookingRoom)(completed.id, { driverId: completed.driver });
    statusEvent(completed, { fare: completed.fare });
    await (0, notify_1.notifyUser)('customer', completed.customer, {
        title: 'Trip completed',
        body: `Total fare ₹${completed.fare?.total}. ${completed.paymentStatus === 'paid' ? 'Paid.' : completed.paymentMethod === 'cash' ? 'Please pay the rider in cash.' : 'Please complete the payment in the app.'}`,
        data: { bookingId: completed.id, type: 'trip_completed' },
    });
    // completeTrip puts the rider back online: take them offline again if their dues are over the limit.
    await (0, riderDues_1.enforceDuesLimit)(completed.driver).catch((err) => console.error('[dues] limit check failed', err));
    res.json({
        booking: await riderView(completed.id),
        fare: completed.fare,
        earning: completed.settlement?.riderEarning,
        collectCash: completed.paymentStatus === 'pending' && completed.paymentMethod === 'cash' ? completed.fare?.total : 0,
    });
}
// POST /bookings/:id/cash-collected
async function confirmCashCollected(req, res) {
    const booking = await findOwnBooking(req);
    if (booking.status !== 'completed')
        throw new http_1.HttpError(409, 'Complete the trip first');
    if (booking.paymentStatus !== 'pending')
        throw new http_1.HttpError(409, 'This booking is already paid');
    await (0, trips_1.settleBookingPayment)(booking.id, { method: 'cash' });
    await (0, gatewayPayments_1.closeBookingPaymentQrs)(booking.id).catch((err) => console.error('[payments] closing payment QR failed', err));
    // The commission on this trip is now dues; past the limit the rider goes offline.
    await (0, riderDues_1.enforceDuesLimit)(booking.driver).catch((err) => console.error('[dues] limit check failed', err));
    const updated = (await Booking_1.Booking.findById(booking.id));
    (0, socket_1.emitBookingEvent)(booking.id, 'booking:status', { bookingId: booking.id, status: updated.status, paymentStatus: updated.paymentStatus, timestamp: new Date().toISOString() }, ['customer', 'admin']);
    res.json(await riderView(booking.id));
}
// POST /bookings/:id/payment-qr: a UPI QR the customer scans to pay the fare online.
async function createPaymentQr(req, res) {
    const booking = await findOwnBooking(req);
    if (booking.status !== 'completed')
        throw new http_1.HttpError(409, 'Complete the trip first');
    if (booking.paymentStatus !== 'pending')
        throw new http_1.HttpError(409, 'This booking is already paid');
    res.status(201).json(await (0, gatewayPayments_1.createBookingPaymentQr)(booking));
}
// GET /bookings/:id/payment-qr: poll while the QR is on screen.
async function getPaymentQrStatus(req, res) {
    const booking = await findOwnBooking(req);
    res.json(await (0, gatewayPayments_1.getBookingPaymentQrStatus)(booking.id));
}
// POST /bookings/:id/cancel: the booking goes back to searching for another rider.
async function cancelByRider(req, res) {
    const driver = driverDoc(req);
    const reason = (0, http_1.requireString)((req.body ?? {}).reason, 'reason', 300);
    const booking = await Booking_1.Booking.findOneAndUpdate({ _id: (0, http_1.requireObjectId)(req.params.id, 'id'), driver: driver._id, status: { $in: RIDER_CANCELLABLE } }, {
        $set: { status: 'requested', driver: null, vehicle: null, partner: null, acceptedAt: null, arrivedAt: null, offer: { driver: null } },
        $addToSet: { rejectedBy: driver._id },
        $push: { timeline: { status: 'requested', at: new Date(), note: `Rider cancelled: ${reason}` } },
    }, { new: true });
    if (!booking)
        throw new http_1.HttpError(409, 'This trip can no longer be cancelled');
    await Driver_1.Driver.updateOne({ _id: driver._id }, { $inc: { cancellations: 1 }, $set: { onlineStatus: 'online' } });
    (0, socket_1.leaveBookingRoom)(booking.id, { driverId: driver._id });
    (0, socket_1.emitBookingEvent)(booking.id, 'booking:status', { bookingId: booking.id, status: 'requested', timestamp: new Date().toISOString(), note: 'Your rider cancelled. Finding you another rider.' }, ['customer', 'admin']);
    await (0, notify_1.notifyUser)('customer', booking.customer, { title: 'Finding another rider', body: 'Your rider had to cancel. We are finding you another one.', data: { bookingId: booking.id, type: 'rider_cancelled' } });
    (0, dispatch_1.startDispatch)(booking.id);
    res.status(204).send();
}
// POST /bookings/:id/rating: rate the customer.
async function rateCustomer(req, res) {
    const booking = await findOwnBooking(req);
    if (booking.status !== 'completed')
        throw new http_1.HttpError(409, 'You can rate the customer once the trip is completed');
    const score = (0, trips_1.parseScore)((req.body ?? {}).score);
    const claimed = await Booking_1.Booking.findOneAndUpdate({ _id: booking._id, ratedByRider: false }, { $set: { ratedByRider: true } });
    if (!claimed)
        throw new http_1.HttpError(409, 'You have already rated this trip');
    const rating = await Rating_1.Rating.create({ booking: booking._id, customer: booking.customer, driver: booking.driver, ratedBy: 'driver', score, comment: (0, http_1.optionalString)((req.body ?? {}).comment, 500) });
    await (0, trips_1.refreshAverageRating)('customer', booking.customer);
    res.status(201).json(rating);
}
// ---------- History and earnings ----------
// GET /bookings?status=&from=&to=
async function listTrips(req, res) {
    const { page, limit, skip } = (0, http_1.parsePagination)(req);
    const filter = { driver: driverDoc(req)._id };
    if (typeof req.query.status === 'string' && req.query.status) {
        const statuses = req.query.status.split(',').map((s) => s.trim());
        if (statuses.some((s) => !Booking_1.BOOKING_STATUSES.includes(s)))
            throw new http_1.HttpError(400, `status must be one of: ${Booking_1.BOOKING_STATUSES.join(', ')}`);
        filter.status = { $in: statuses };
    }
    const from = (0, http_1.parseDate)(req.query.from, 'from');
    const to = (0, http_1.parseDate)(req.query.to, 'to', true);
    if (from || to)
        filter.createdAt = { ...(from ? { $gte: from } : {}), ...(to ? { $lte: to } : {}) };
    const [items, total] = await Promise.all([
        Booking_1.Booking.find(filter).populate('customer', trips_1.CUSTOMER_PUBLIC_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Booking_1.Booking.countDocuments(filter),
    ]);
    res.json({ items: items.map((b) => (0, trips_1.serializeBooking)(b, { viewer: 'rider' })), total, page, limit });
}
// GET /earnings?from=&to= (defaults to the last 7 days)
async function getEarnings(req, res) {
    const to = (0, http_1.parseDate)(req.query.to, 'to', true) ?? new Date();
    const from = (0, http_1.parseDate)(req.query.from, 'from') ?? new Date(to.getTime() - EARNINGS_DEFAULT_DAYS * 86_400_000);
    if (from > to)
        throw new http_1.HttpError(400, 'from must be before to');
    const trips = await Booking_1.Booking.find({ driver: new mongoose_1.Types.ObjectId(driverDoc(req).id), status: 'completed', completedAt: { $gte: from, $lte: to } })
        .select('bookingCode mode categoryKey completedAt fare settlement paymentMethod paymentStatus distanceKm')
        .sort({ completedAt: -1 });
    const perTrip = trips.map((t) => ({
        bookingId: t.id,
        bookingCode: t.bookingCode,
        mode: t.mode,
        categoryKey: t.categoryKey,
        completedAt: t.completedAt,
        distanceKm: t.distanceKm,
        fare: t.fare?.total ?? 0,
        commission: t.settlement?.commission ?? 0,
        earning: t.settlement?.riderEarning ?? 0,
        tip: t.fare?.tip ?? 0,
        paymentMethod: t.paymentMethod,
        paymentStatus: t.paymentStatus,
    }));
    const sum = (pick, list = perTrip) => (0, http_1.roundMoney)(list.reduce((acc, t) => acc + pick(t), 0));
    res.json({
        from,
        to,
        summary: {
            trips: perTrip.length,
            grossFare: sum((t) => t.fare),
            commission: sum((t) => t.commission),
            netEarnings: sum((t) => t.earning),
            tips: sum((t) => t.tip),
            cashCollected: sum((t) => t.fare, perTrip.filter((t) => t.paymentMethod === 'cash' && t.paymentStatus === 'paid')),
        },
        perTrip,
    });
}
//# sourceMappingURL=trips.controller.js.map