"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VEHICLE_PUBLIC_FIELDS = exports.CUSTOMER_TRIP_FIELDS = exports.CUSTOMER_PUBLIC_FIELDS = exports.RIDER_PUBLIC_FIELDS = void 0;
exports.generateBookingCode = generateBookingCode;
exports.generateTripOtp = generateTripOtp;
exports.ensureRidePin = ensureRidePin;
exports.routePoints = routePoints;
exports.repriceBooking = repriceBooking;
exports.serializeBooking = serializeBooking;
exports.activeVehicleFor = activeVehicleFor;
exports.completeTrip = completeTrip;
exports.settleBookingPayment = settleBookingPayment;
exports.refreshAverageRating = refreshAverageRating;
exports.parseScore = parseScore;
// Booking money flow and serialization shared by the customer and rider apps.
const crypto_1 = __importDefault(require("crypto"));
const referral_1 = require("../utils/referral");
const Booking_1 = require("../models/Booking");
const Customer_1 = require("../models/Customer");
const Driver_1 = require("../models/Driver");
const Payment_1 = require("../models/Payment");
const Rating_1 = require("../models/Rating");
const Vehicle_1 = require("../models/Vehicle");
const fare_1 = require("../utils/fare");
const http_1 = require("../utils/http");
const maps_1 = require("../utils/maps");
const wallet_1 = require("../utils/wallet");
function generateBookingCode() {
    return `BK-${Date.now().toString(36).toUpperCase()}${crypto_1.default.randomInt(10, 99)}`;
}
function generateTripOtp() {
    return crypto_1.default.randomInt(0, 10_000).toString().padStart(4, '0');
}
// Ride PINs are 4 digits (what the rider app takes), so at most 10,000 customers can have one.
const RIDE_PIN_COUNT = 10_000;
const RIDE_PIN_RANDOM_TRIES = 20;
/** A PIN no customer has yet, or null when all are taken. */
async function randomFreeRidePin() {
    const taken = new Set(await Customer_1.Customer.distinct('ridePin', { ridePin: { $type: 'string' } }));
    const free = [];
    for (let n = 0; n < RIDE_PIN_COUNT; n++) {
        const pin = String(n).padStart(4, '0');
        if (!taken.has(pin))
            free.push(pin);
    }
    return free.length ? free[crypto_1.default.randomInt(free.length)] : null;
}
/**
 * The customer's own Ride PIN, created once and unique to them (a unique index enforces it);
 * every trip starts with it instead of a new OTP.
 */
async function ensureRidePin(customerId) {
    const existing = await Customer_1.Customer.findById(customerId).select('ridePin');
    if (existing?.ridePin)
        return existing.ridePin;
    // Random PINs first; once they keep colliding (most PINs taken), pick from the free ones.
    for (let attempt = 0; attempt < RIDE_PIN_RANDOM_TRIES + 3; attempt++) {
        const pin = attempt < RIDE_PIN_RANDOM_TRIES ? generateTripOtp() : await randomFreeRidePin();
        if (!pin)
            break;
        try {
            // Only set while still empty so two concurrent logins cannot end up with different PINs.
            await Customer_1.Customer.updateOne({ _id: customerId, ridePin: { $in: [null, ''] } }, { $set: { ridePin: pin } });
            return (await Customer_1.Customer.findById(customerId).select('ridePin')).ridePin;
        }
        catch (err) {
            if (err.code !== 11000)
                throw err; // another customer has this PIN: try another
        }
    }
    console.error('[ride-pin] no free Ride PIN left for customer', customerId.toString());
    throw new http_1.HttpError(503, 'Could not set up your Ride PIN. Please try again later.');
}
/** Pickup → stops (transport) or pickup → drop (ride), as points. */
function routePoints(booking) {
    const points = [{ lat: booking.pickup.lat, lng: booking.pickup.lng }];
    if (booking.mode === 'transport' && booking.stops.length) {
        for (const s of booking.stops)
            points.push({ lat: s.lat, lng: s.lng });
    }
    else {
        points.push({ lat: booking.drop.lat, lng: booking.drop.lng });
    }
    return points;
}
/** Re-prices the booking from its current route (after a drop change or at trip end). */
async function repriceBooking(booking, opts = {}) {
    const rule = await (0, fare_1.findPricingRule)(booking.categoryKey, booking.serviceArea);
    if (!rule)
        throw new http_1.HttpError(409, 'Pricing is not configured for this vehicle category');
    const { distanceKm, durationMin } = await (0, maps_1.routeMetrics)(routePoints(booking));
    const fare = (0, fare_1.computeFare)(rule, {
        distanceKm,
        durationMin,
        extraStops: Math.max(0, booking.stops.length - 1),
        needsLoading: Boolean(booking.goodsDetails?.needsLoading),
        waitingMin: opts.waitingMin,
        discount: booking.fare?.discount ?? 0,
        at: booking.startedAt ?? booking.createdAt,
    });
    fare.tip = booking.fare?.tip ?? 0;
    booking.set({ fare, distanceKm, durationMin });
    return fare;
}
/** Booking as returned to the apps (populated rider/customer/vehicle when loaded). */
function serializeBooking(booking, { viewer }) {
    const json = booking.toJSON();
    delete json.offer;
    delete json.rejectedBy;
    delete json.dispatchAttempts;
    delete json.shareToken;
    if (viewer === 'rider') {
        delete json.startOtp;
        json.stops = (json.stops ?? []).map(({ otp: _otp, ...stop }) => stop);
        // The rider sees the customer's phone only while the trip is active, so they can call them.
        json.customer = maskPerson(json.customer, { keepPhone: Booking_1.ACTIVE_TRIP_STATUSES.includes(booking.status) });
    }
    else {
        delete json.settlement;
        json.driver = maskPerson(json.driver);
    }
    return json;
}
// The rider's phone is never shown to the customer (calls go through /call); the customer's
// phone is shown to their rider during an active trip.
function maskPerson(person, { keepPhone = false } = {}) {
    if (!person || typeof person !== 'object')
        return person;
    const { phone, email: _email, ...rest } = person;
    return keepPhone ? { ...rest, phone } : rest;
}
exports.RIDER_PUBLIC_FIELDS = 'name rating photoUrl currentLocation';
exports.CUSTOMER_PUBLIC_FIELDS = 'name rating photoUrl';
/** What the rider loads about the customer for one trip; the phone is dropped outside an active trip. */
exports.CUSTOMER_TRIP_FIELDS = `${exports.CUSTOMER_PUBLIC_FIELDS} phone`;
exports.VEHICLE_PUBLIC_FIELDS = 'registrationNumber model manufacturer categoryKey';
/** The vehicle a rider drives: the admin-assigned one, else their latest active vehicle. */
async function activeVehicleFor(driverId, assignedVehicle) {
    if (assignedVehicle) {
        const assigned = await Vehicle_1.Vehicle.findOne({ _id: assignedVehicle, status: 'active' });
        if (assigned)
            return assigned;
    }
    return Vehicle_1.Vehicle.findOne({ ownerType: 'driver', ownerId: driverId, status: 'active' }).sort({ updatedAt: -1 });
}
// ---------- Completion and payment ----------
/** Ends the trip: final fare (with waiting time), commission, rider stats. Payment is settled separately. */
async function completeTrip(bookingId, driverId, freeWaitingMinutes) {
    const now = new Date();
    // Atomic transition so a repeated "complete" can never settle the trip twice.
    const booking = await Booking_1.Booking.findOneAndUpdate({ _id: bookingId, driver: driverId, status: { $in: ['started', 'in_transit'] } }, { $set: { status: 'completed', completedAt: now } }, { new: true });
    if (!booking)
        throw new http_1.HttpError(409, 'This trip is not in progress');
    const waited = booking.arrivedAt && booking.startedAt ? (booking.startedAt.getTime() - booking.arrivedAt.getTime()) / 60_000 : 0;
    const waitingMin = Math.max(0, Math.ceil(waited - freeWaitingMinutes));
    const fare = await repriceBooking(booking, { waitingMin });
    const commission = await (0, fare_1.computeCommission)(booking.categoryKey, fare.total);
    booking.set({ settlement: { commission, riderEarning: (0, http_1.roundMoney)(fare.total - commission) } });
    booking.timeline.push({ status: 'completed', at: now, note: 'Trip completed' });
    await booking.save();
    await Promise.all([
        Driver_1.Driver.updateOne({ _id: booking.driver }, { $inc: { totalTrips: 1 }, $set: { onlineStatus: 'online' } }),
        Customer_1.Customer.updateOne({ _id: booking.customer }, { $inc: { totalBookings: 1 } }),
    ]);
    await (0, referral_1.awardReferralReward)(booking.customer).catch((err) => console.error('[referral] reward failed', err));
    // Wallet bookings are charged straight away; cash waits for the rider, online for the gateway.
    if (fare.total <= 0) {
        await settleBookingPayment(booking.id, { method: 'wallet' });
    }
    else if (booking.paymentMethod === 'wallet') {
        try {
            await (0, wallet_1.debitWallet)({ ownerType: 'customer', ownerId: booking.customer, amount: fare.total, reason: 'booking_payment', referenceType: 'Booking', referenceId: booking._id });
            await settleBookingPayment(booking.id, { method: 'wallet' });
        }
        catch (err) {
            // Not enough balance: the booking stays unpaid and the customer pays online from the app.
            if (!(err instanceof http_1.HttpError && err.status === 402))
                throw err;
        }
    }
    return Booking_1.Booking.findById(booking.id);
}
/**
 * Marks a completed booking paid (once) and moves the rider's share:
 * cash → the rider already holds the money, so the commission becomes dues;
 * wallet/online → the platform collected it, so the rider's earning is credited.
 */
async function settleBookingPayment(bookingId, opts) {
    const booking = await Booking_1.Booking.findOneAndUpdate({ _id: bookingId, status: 'completed', paymentStatus: 'pending' }, { $set: { paymentStatus: 'paid' }, $push: { timeline: { status: 'paid', at: new Date(), note: `Paid by ${opts.method}` } } }, { new: true });
    if (!booking)
        return null;
    const total = booking.fare?.total ?? 0;
    await Payment_1.Payment.create({
        booking: booking._id,
        amount: total,
        // An online payment for a cash/wallet booking is recorded as UPI.
        method: opts.method !== 'online' ? opts.method : ['upi', 'card', 'netbanking'].includes(booking.paymentMethod) ? booking.paymentMethod : 'upi',
        gateway: opts.method === 'cash' ? 'cash' : opts.method === 'online' ? opts.gateway ?? 'internal' : 'internal',
        gatewayRefId: opts.gatewayRefId,
        status: 'success',
    });
    const { commission = 0, riderEarning = 0 } = booking.settlement ?? {};
    const ref = { referenceType: 'Booking', referenceId: booking._id };
    if (opts.method === 'cash') {
        await (0, wallet_1.debitWallet)({ ownerType: 'driver', ownerId: booking.driver, amount: commission, reason: 'commission', allowNegative: true, ...ref });
    }
    else {
        await (0, wallet_1.creditWallet)({ ownerType: 'driver', ownerId: booking.driver, amount: riderEarning, reason: 'booking_earning', ...ref });
    }
    await Driver_1.Driver.updateOne({ _id: booking.driver }, { $inc: { earnings: riderEarning } });
    return booking;
}
// ---------- Ratings ----------
async function refreshAverageRating(target, id) {
    const match = target === 'driver' ? { driver: id, ratedBy: 'customer' } : { customer: id, ratedBy: 'driver' };
    const [result] = await Rating_1.Rating.aggregate([{ $match: match }, { $group: { _id: null, avg: { $avg: '$score' } } }]);
    const rating = result ? Math.round(result.avg * 10) / 10 : 0;
    if (target === 'driver')
        await Driver_1.Driver.updateOne({ _id: id }, { rating });
    else
        await Customer_1.Customer.updateOne({ _id: id }, { rating });
}
function parseScore(value) {
    const score = typeof value === 'string' ? Number(value) : value;
    if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > 5)
        throw new http_1.HttpError(400, 'score must be a whole number from 1 to 5');
    return score;
}
//# sourceMappingURL=trips.js.map