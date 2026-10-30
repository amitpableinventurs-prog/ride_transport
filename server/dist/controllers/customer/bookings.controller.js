"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fareEstimate = fareEstimate;
exports.createBooking = createBooking;
exports.listBookings = listBookings;
exports.getBooking = getBooking;
exports.trackBooking = trackBooking;
exports.changeDrop = changeDrop;
exports.cancelBooking = cancelBooking;
exports.retryBooking = retryBooking;
exports.rateRider = rateRider;
exports.getInvoice = getInvoice;
exports.shareBooking = shareBooking;
exports.callRider = callRider;
// Customer app: fare estimates and the booking lifecycle.
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("../../config/env");
const Booking_1 = require("../../models/Booking");
const Coupon_1 = require("../../models/Coupon");
const Driver_1 = require("../../models/Driver");
const Rating_1 = require("../../models/Rating");
const ServiceCategory_1 = require("../../models/ServiceCategory");
const socket_1 = require("../../realtime/socket");
const dispatch_1 = require("../../services/dispatch");
const trips_1 = require("../../services/trips");
const appUsers_1 = require("../../utils/appUsers");
const coupons_1 = require("../../utils/coupons");
const fare_1 = require("../../utils/fare");
const geo_1 = require("../../utils/geo");
const maps_1 = require("../../utils/maps");
const http_1 = require("../../utils/http");
const jwt_1 = require("../../utils/jwt");
const notify_1 = require("../../utils/notify");
const phone_1 = require("../../utils/phone");
const settings_1 = require("../../utils/settings");
const telephony_1 = require("../../utils/telephony");
const wallet_1 = require("../../utils/wallet");
const MAX_TRANSPORT_STOPS = 5;
const MAX_SCHEDULE_DAYS = 7;
const MIN_SCHEDULE_AHEAD_MIN = 30;
const PAYMENT_METHODS = ['cash', 'wallet', 'upi', 'card', 'netbanking'];
const CUSTOMER_CANCELLABLE = ['scheduled', 'requested', 'no_rider_found', 'accepted', 'arriving', 'arrived'];
const DROP_CHANGEABLE = ['accepted', 'arriving', 'arrived', 'started', 'in_transit'];
const MAX_TIP = 500;
function customerDoc(req) {
    return req.appUser.doc;
}
async function findOwnBooking(req) {
    const booking = await Booking_1.Booking.findOne({ _id: (0, http_1.requireObjectId)(req.params.id, 'id'), customer: customerDoc(req)._id });
    if (!booking)
        throw new http_1.HttpError(404, 'Booking not found');
    return booking;
}
async function populated(bookingId) {
    return (await Booking_1.Booking.findById(bookingId).populate('driver', trips_1.RIDER_PUBLIC_FIELDS).populate('vehicle', trips_1.VEHICLE_PUBLIC_FIELDS));
}
function parseTripInput(body) {
    const pickup = (0, geo_1.parsePlace)(body.pickup, 'pickup');
    const rawDrops = Array.isArray(body.drops) ? body.drops : body.drop ? [body.drop] : [];
    if (!rawDrops.length)
        throw new http_1.HttpError(400, 'drops (or drop) is required');
    if (rawDrops.length > MAX_TRANSPORT_STOPS)
        throw new http_1.HttpError(400, `A booking can have at most ${MAX_TRANSPORT_STOPS} drops`);
    const drops = rawDrops.map((d, i) => {
        const place = (0, geo_1.parsePlace)(d, `drops[${i}]`);
        const contactName = (0, http_1.optionalString)(d?.contactName, 80);
        if (contactName)
            place.contactName = contactName;
        if (d?.contactPhone !== undefined && d.contactPhone !== '') {
            const phone = (0, phone_1.normalizeIndianMobile)(d.contactPhone);
            if (!phone)
                throw new http_1.HttpError(400, `drops[${i}].contactPhone must be a valid 10-digit mobile number`);
            place.contactPhone = phone;
        }
        return place;
    });
    const g = body.goods;
    const weightKg = g?.weightKg !== undefined ? Number(g.weightKg) : undefined;
    if (weightKg !== undefined && (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 50_000))
        throw new http_1.HttpError(400, 'goods.weightKg must be a positive number');
    const goods = g
        ? { description: (0, http_1.optionalString)(g.description, 200), weightKg, notes: (0, http_1.optionalString)(g.notes, 500), needsLoading: g.needsLoading === true || g.needsLoading === 'true' }
        : undefined;
    return { pickup, drops, goods };
}
async function routeFor(mode, trip) {
    const points = mode === 'ride' ? [trip.pickup, trip.drops[0]] : [trip.pickup, ...trip.drops];
    return { ...(await (0, maps_1.routeMetrics)(points)), extraStops: mode === 'transport' ? trip.drops.length - 1 : 0 };
}
async function priceCategory(category, trip, serviceAreaId, at) {
    const rule = await (0, fare_1.findPricingRule)(category.key, serviceAreaId);
    if (!rule)
        return null;
    const route = await routeFor(category.mode, trip);
    return { ...route, fare: (0, fare_1.computeFare)(rule, { ...route, needsLoading: category.mode === 'transport' && trip.goods?.needsLoading, at }) };
}
async function serviceAreaFor(pickup) {
    const area = await (0, geo_1.findServiceArea)(pickup);
    if (!area)
        throw new http_1.HttpError(422, "We don't operate at this pickup location yet");
    return area;
}
// POST /fare-estimate
async function fareEstimate(req, res) {
    const body = req.body;
    const trip = parseTripInput(body);
    const [area, settings] = await Promise.all([serviceAreaFor(trip.pickup), (0, settings_1.getPlatformSettings)()]);
    const couponCode = (0, http_1.optionalString)(body.couponCode, 40);
    const at = body.scheduledAt ? (0, http_1.parseDate)(body.scheduledAt, 'scheduledAt') : undefined;
    const modes = [
        ...(settings.rideServiceEnabled && area.rideEnabled && trip.drops.length === 1 ? ['ride'] : []),
        ...(settings.transportServiceEnabled && area.transportEnabled ? ['transport'] : []),
    ].filter((m) => !body.mode || body.mode === m);
    const filter = { status: 'active', mode: { $in: modes } };
    if (body.categoryKey)
        filter.key = body.categoryKey;
    const categories = await ServiceCategory_1.ServiceCategory.find(filter).sort({ mode: 1, sortOrder: 1 });
    // Categories are priced in parallel: each one only reads (cached) rules.
    const results = await Promise.all(categories.map(async (category) => ({ category, priced: await priceCategory(category, trip, area._id, at) })));
    const estimates = [];
    for (const { category, priced } of results) {
        if (!priced)
            continue;
        let coupon;
        if (couponCode) {
            try {
                const applied = await (0, coupons_1.applyCoupon)({ code: couponCode, customerId: customerDoc(req)._id, mode: category.mode, categoryKey: category.key, serviceAreaId: area._id, fareTotal: priced.fare.total });
                coupon = { code: applied.code, discount: applied.discount };
                priced.fare.discount = applied.discount;
                priced.fare.total -= applied.discount;
            }
            catch (err) {
                if (!(err instanceof http_1.HttpError))
                    throw err;
                coupon = { error: err.message };
            }
        }
        estimates.push({ categoryKey: category.key, mode: category.mode, name: category.name, icon: category.icon, ...priced, ...(coupon ? { coupon } : {}) });
    }
    res.json({ serviceArea: { id: area.id, name: area.name, city: area.city }, estimates });
}
// ---------- Create and list ----------
// POST /bookings
async function createBooking(req, res) {
    const customer = customerDoc(req);
    const body = req.body;
    if (!(0, appUsers_1.isProfileComplete)(req.appUser))
        throw new http_1.HttpError(403, 'Please complete your profile before booking');
    const category = await ServiceCategory_1.ServiceCategory.findOne({ key: (0, http_1.requireString)(body.categoryKey, 'categoryKey', 60), status: 'active' });
    if (!category)
        throw new http_1.HttpError(400, 'Unknown vehicle category');
    if (body.mode !== undefined && body.mode !== category.mode)
        throw new http_1.HttpError(400, `${category.name} is a ${category.mode} category`);
    const mode = category.mode;
    const paymentMethod = (body.paymentMethod ?? 'cash');
    if (!PAYMENT_METHODS.includes(paymentMethod))
        throw new http_1.HttpError(400, `paymentMethod must be one of: ${PAYMENT_METHODS.join(', ')}`);
    const trip = parseTripInput(body);
    if (mode === 'ride' && trip.drops.length > 1)
        throw new http_1.HttpError(400, 'Rides have a single drop');
    if (mode === 'transport' && !trip.goods?.description)
        throw new http_1.HttpError(400, 'goods.description is required for transport bookings');
    const [area, settings] = await Promise.all([serviceAreaFor(trip.pickup), (0, settings_1.getPlatformSettings)()]);
    const modeEnabled = mode === 'ride' ? settings.rideServiceEnabled && area.rideEnabled : settings.transportServiceEnabled && area.transportEnabled;
    if (!modeEnabled)
        throw new http_1.HttpError(422, `${mode === 'ride' ? 'Rides are' : 'Transport is'} not available at this location right now`);
    const scheduledAt = (0, http_1.parseDate)(body.scheduledAt, 'scheduledAt');
    if (scheduledAt) {
        const minutesAhead = (scheduledAt.getTime() - Date.now()) / 60_000;
        if (minutesAhead < MIN_SCHEDULE_AHEAD_MIN || minutesAhead > MAX_SCHEDULE_DAYS * 1440) {
            throw new http_1.HttpError(400, `Scheduled bookings must be between ${MIN_SCHEDULE_AHEAD_MIN} minutes and ${MAX_SCHEDULE_DAYS} days ahead`);
        }
    }
    else {
        const ongoing = await Booking_1.Booking.findOne({ customer: customer._id, status: { $in: ['requested', ...Booking_1.ACTIVE_TRIP_STATUSES] } }).select('_id bookingCode');
        if (ongoing)
            throw new http_1.HttpError(409, `You already have an ongoing booking (${ongoing.bookingCode})`, { bookingId: ongoing.id });
    }
    const priced = await priceCategory(category, trip, area._id, scheduledAt);
    if (!priced)
        throw new http_1.HttpError(422, `${category.name} is not available in ${area.city} right now`);
    let couponCode;
    if (body.couponCode) {
        const applied = await (0, coupons_1.applyCoupon)({ code: String(body.couponCode), customerId: customer._id, mode, categoryKey: category.key, serviceAreaId: area._id, fareTotal: priced.fare.total });
        couponCode = applied.code;
        priced.fare.discount = applied.discount;
        priced.fare.total -= applied.discount;
    }
    if (paymentMethod === 'wallet') {
        const wallet = await (0, wallet_1.getOrCreateWallet)('customer', customer._id);
        if (wallet.balance < priced.fare.total)
            throw new http_1.HttpError(402, 'Not enough wallet balance for this booking', { balance: wallet.balance, required: priced.fare.total });
    }
    const lastDrop = trip.drops[trip.drops.length - 1];
    const status = scheduledAt ? 'scheduled' : 'requested';
    const booking = await Booking_1.Booking.create({
        bookingCode: (0, trips_1.generateBookingCode)(),
        mode,
        categoryKey: category.key,
        customer: customer._id,
        pickup: trip.pickup,
        drop: { address: lastDrop.address, lat: lastDrop.lat, lng: lastDrop.lng },
        stops: mode === 'transport' ? trip.drops.map((d) => ({ ...d, otp: (0, trips_1.generateTripOtp)() })) : [],
        goodsDetails: mode === 'transport' ? trip.goods : undefined,
        status,
        scheduledAt: scheduledAt ?? null,
        fare: priced.fare,
        couponCode,
        distanceKm: priced.distanceKm,
        durationMin: priced.durationMin,
        paymentMethod,
        serviceArea: area._id,
        startOtp: await (0, trips_1.ensureRidePin)(customer._id),
        timeline: [{ status, note: scheduledAt ? `Scheduled for ${scheduledAt.toISOString()}` : 'Booking created' }],
    });
    if (couponCode)
        await Coupon_1.Coupon.updateOne({ code: couponCode }, { $inc: { usedCount: 1 } });
    (0, socket_1.joinBookingRoom)(booking.id, { customerId: customer._id });
    (0, socket_1.emitBookingEvent)(booking.id, 'booking:status', { bookingId: booking.id, status, timestamp: new Date().toISOString() }, ['admin']);
    if (status === 'requested')
        (0, dispatch_1.startDispatch)(booking.id);
    res.status(201).json((0, trips_1.serializeBooking)(booking, { viewer: 'customer' }));
}
// GET /bookings?mode=&status=&from=&to=
async function listBookings(req, res) {
    const { page, limit, skip } = (0, http_1.parsePagination)(req);
    const filter = { customer: customerDoc(req)._id };
    if (req.query.mode === 'ride' || req.query.mode === 'transport')
        filter.mode = req.query.mode;
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
        Booking_1.Booking.find(filter).populate('driver', trips_1.RIDER_PUBLIC_FIELDS).populate('vehicle', trips_1.VEHICLE_PUBLIC_FIELDS).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Booking_1.Booking.countDocuments(filter),
    ]);
    res.json({ items: items.map((b) => (0, trips_1.serializeBooking)(b, { viewer: 'customer' })), total, page, limit });
}
// GET /bookings/:id
async function getBooking(req, res) {
    const booking = await findOwnBooking(req);
    const [full, rating] = await Promise.all([populated(booking.id), Rating_1.Rating.findOne({ booking: booking._id, ratedBy: 'customer' }).select('score comment')]);
    res.json({ ...(0, trips_1.serializeBooking)(full, { viewer: 'customer' }), myRating: rating });
}
// GET /bookings/:id/track: polling fallback for the socket's booking:rider_location.
async function trackBooking(req, res) {
    const booking = await findOwnBooking(req);
    const driver = booking.driver ? await Driver_1.Driver.findById(booking.driver).select('currentLocation') : null;
    const location = driver?.currentLocation?.lat != null ? driver.currentLocation : null;
    const beforePickup = ['accepted', 'arriving', 'arrived'].includes(booking.status);
    const nextStop = booking.stops.find((s) => s.status === 'pending');
    const target = beforePickup ? booking.pickup : nextStop ?? booking.drop;
    const etaMin = location && Booking_1.ACTIVE_TRIP_STATUSES.includes(booking.status) && target?.lat != null
        ? (0, geo_1.etaMinutes)({ lat: location.lat, lng: location.lng }, { lat: target.lat, lng: target.lng })
        : null;
    res.json({
        bookingId: booking.id,
        status: booking.status,
        rider: location ? { lat: location.lat, lng: location.lng, heading: location.heading, updatedAt: location.updatedAt } : null,
        etaMin,
        etaTo: beforePickup ? 'pickup' : 'drop',
    });
}
// ---------- During the trip ----------
// PATCH /bookings/:id/drop
async function changeDrop(req, res) {
    const booking = await findOwnBooking(req);
    if (!DROP_CHANGEABLE.includes(booking.status))
        throw new http_1.HttpError(409, 'The drop can only be changed once a rider is assigned and before the trip ends');
    const drop = (0, geo_1.parsePlace)(req.body.drop, 'drop');
    const area = await (0, geo_1.findServiceArea)(drop);
    if (!area)
        throw new http_1.HttpError(422, "We don't operate at this drop location");
    if (booking.mode === 'transport') {
        const lastPending = [...booking.stops].reverse().find((s) => s.status === 'pending');
        if (!lastPending)
            throw new http_1.HttpError(409, 'All drops have been completed');
        lastPending.set({ address: drop.address, lat: drop.lat, lng: drop.lng });
    }
    booking.drop = { address: drop.address, lat: drop.lat, lng: drop.lng };
    const fare = await (0, trips_1.repriceBooking)(booking);
    booking.timeline.push({ status: booking.status, at: new Date(), note: 'Drop location changed by customer' });
    await booking.save();
    const event = { bookingId: booking.id, fare, distanceKm: booking.distanceKm, drop: booking.drop };
    (0, socket_1.emitBookingEvent)(booking.id, 'booking:fare_updated', event, ['customer', 'rider']);
    res.json((0, trips_1.serializeBooking)(await populated(booking.id), { viewer: 'customer' }));
}
// POST /bookings/:id/cancel
async function cancelBooking(req, res) {
    const booking = await findOwnBooking(req);
    if (!CUSTOMER_CANCELLABLE.includes(booking.status))
        throw new http_1.HttpError(409, 'This booking can no longer be cancelled');
    const reason = (0, http_1.optionalString)((req.body ?? {}).reason, 300) ?? 'Cancelled by customer';
    // Cancelling is always free; `charge` stays 0 in the response and events for the apps.
    const charge = 0;
    const offeredTo = booking.status === 'requested' ? booking.offer?.driver : null;
    const cancelled = await Booking_1.Booking.findOneAndUpdate({ _id: booking._id, status: booking.status }, {
        $set: { status: 'cancelled', cancellation: { by: 'customer', reason, chargedAmount: charge }, offer: { driver: null } },
        $push: { timeline: { status: 'cancelled', at: new Date(), note: reason } },
    }, { new: true });
    if (!cancelled)
        throw new http_1.HttpError(409, 'The booking changed in the meantime. Please refresh and try again.');
    (0, dispatch_1.stopDispatch)(booking.id);
    if (cancelled.couponCode)
        await Coupon_1.Coupon.updateOne({ code: cancelled.couponCode, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
    if (offeredTo)
        (0, socket_1.emitToRider)(offeredTo, 'booking:request_expired', { bookingId: booking.id });
    if (cancelled.driver) {
        await Driver_1.Driver.updateOne({ _id: cancelled.driver, onlineStatus: 'on_trip' }, { onlineStatus: 'online' });
        await (0, notify_1.notifyUser)('driver', cancelled.driver, { title: 'Trip cancelled', body: `The customer cancelled ${cancelled.bookingCode}`, data: { bookingId: booking.id, type: 'booking_cancelled' } });
    }
    (0, socket_1.emitBookingEvent)(booking.id, 'booking:cancelled', { bookingId: booking.id, by: 'customer', reason, charge }, ['customer', 'rider', 'admin']);
    (0, socket_1.leaveBookingRoom)(booking.id);
    res.json({ ...(0, trips_1.serializeBooking)(cancelled, { viewer: 'customer' }), chargeApplied: charge });
}
// POST /bookings/:id/retry: search again after "no rider found".
async function retryBooking(req, res) {
    const booking = await findOwnBooking(req);
    const retried = await Booking_1.Booking.findOneAndUpdate({ _id: booking._id, status: 'no_rider_found' }, {
        $set: { status: 'requested', rejectedBy: [], dispatchAttempts: 0, offer: { driver: null } },
        $push: { timeline: { status: 'requested', at: new Date(), note: 'Customer retried the search' } },
    }, { new: true });
    if (!retried)
        throw new http_1.HttpError(409, 'Only bookings with no rider found can be retried');
    (0, socket_1.joinBookingRoom)(retried.id, { customerId: retried.customer });
    (0, socket_1.emitBookingEvent)(retried.id, 'booking:status', { bookingId: retried.id, status: 'requested', timestamp: new Date().toISOString() }, ['customer', 'admin']);
    (0, dispatch_1.startDispatch)(retried.id);
    res.json((0, trips_1.serializeBooking)(retried, { viewer: 'customer' }));
}
// ---------- After the trip ----------
// POST /bookings/:id/rating: rate the rider and optionally tip from the wallet.
async function rateRider(req, res) {
    const booking = await findOwnBooking(req);
    if (booking.status !== 'completed' || !booking.driver)
        throw new http_1.HttpError(409, 'You can rate the rider once the trip is completed');
    const body = req.body;
    const score = (0, trips_1.parseScore)(body.score);
    const comment = (0, http_1.optionalString)(body.comment, 500);
    const tip = body.tip !== undefined && body.tip !== 0 ? (0, http_1.parseAmount)(body.tip, 'tip', { min: 1, max: MAX_TIP }) : 0;
    const claimed = await Booking_1.Booking.findOneAndUpdate({ _id: booking._id, ratedByCustomer: false }, { $set: { ratedByCustomer: true } });
    if (!claimed)
        throw new http_1.HttpError(409, 'You have already rated this trip');
    if (tip) {
        const ref = { referenceType: 'Booking', referenceId: booking._id };
        try {
            await (0, wallet_1.debitWallet)({ ownerType: 'customer', ownerId: booking.customer, amount: tip, reason: 'tip', ...ref });
        }
        catch (err) {
            await Booking_1.Booking.updateOne({ _id: booking._id }, { $set: { ratedByCustomer: false } });
            throw err;
        }
        await (0, wallet_1.creditWallet)({ ownerType: 'driver', ownerId: booking.driver, amount: tip, reason: 'tip', ...ref });
        await Booking_1.Booking.updateOne({ _id: booking._id }, { $inc: { 'fare.tip': tip } });
    }
    const rating = await Rating_1.Rating.create({ booking: booking._id, customer: booking.customer, driver: booking.driver, ratedBy: 'customer', score, comment });
    await (0, trips_1.refreshAverageRating)('driver', booking.driver);
    res.status(201).json({ rating, tip });
}
// GET /bookings/:id/invoice
async function getInvoice(req, res) {
    const booking = await findOwnBooking(req);
    if (booking.status !== 'completed')
        throw new http_1.HttpError(409, 'The invoice is available once the trip is completed');
    res.json({ url: `${env_1.env.publicBaseUrl}/api/v1/public/invoices/${(0, jwt_1.signInvoiceToken)(booking.id)}`, expiresInDays: 7 });
}
// POST /bookings/:id/share: public live-tracking link for friends and family.
async function shareBooking(req, res) {
    const booking = await findOwnBooking(req);
    if (!['requested', ...Booking_1.ACTIVE_TRIP_STATUSES].includes(booking.status))
        throw new http_1.HttpError(409, 'Only ongoing trips can be shared');
    if (!booking.shareToken) {
        booking.shareToken = crypto_1.default.randomBytes(16).toString('base64url');
        await booking.save();
    }
    res.json({ url: `${env_1.env.publicBaseUrl}/api/v1/public/track/${booking.shareToken}`, token: booking.shareToken });
}
// POST /bookings/:id/call: number to call the rider without revealing either phone.
async function callRider(req, res) {
    const booking = await findOwnBooking(req);
    if (!Booking_1.ACTIVE_TRIP_STATUSES.includes(booking.status) || !booking.driver)
        throw new http_1.HttpError(409, 'You can call the rider during an active trip');
    const driver = await Driver_1.Driver.findById(booking.driver).select('phone');
    if (!driver)
        throw new http_1.HttpError(404, 'Rider not found');
    res.json(await (0, telephony_1.getTelephonyProvider)().bridge(booking.id, customerDoc(req).phone, driver.phone));
}
//# sourceMappingURL=bookings.controller.js.map