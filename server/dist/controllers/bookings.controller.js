"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBookings = listBookings;
exports.getBooking = getBooking;
exports.listAvailableDrivers = listAvailableDrivers;
exports.assignBooking = assignBooking;
exports.updateBookingStatus = updateBookingStatus;
exports.deleteBooking = deleteBooking;
const mongoose_1 = require("mongoose");
const Booking_1 = require("../models/Booking");
const ChatMessage_1 = require("../models/ChatMessage");
const CoinTransaction_1 = require("../models/CoinTransaction");
const Customer_1 = require("../models/Customer");
const Driver_1 = require("../models/Driver");
const GatewayOrder_1 = require("../models/GatewayOrder");
const Payment_1 = require("../models/Payment");
const Rating_1 = require("../models/Rating");
const Refund_1 = require("../models/Refund");
const SosRequest_1 = require("../models/SosRequest");
const Ticket_1 = require("../models/Ticket");
const WalletTransaction_1 = require("../models/WalletTransaction");
const trips_1 = require("../services/trips");
const audit_1 = require("../utils/audit");
const notify_1 = require("../utils/notify");
const socket_1 = require("../realtime/socket");
const dispatch_1 = require("../services/dispatch");
const regex_1 = require("../utils/regex");
const CUSTOMER_FIELDS = 'name phone email';
const DRIVER_FIELDS = 'name phone rating onlineStatus currentLocation';
const VEHICLE_FIELDS = 'registrationNumber model capacity';
async function listBookings(req, res) {
    const { mode, status, paymentStatus, q } = req.query;
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 20));
    const filter = {};
    if (mode)
        filter.mode = mode;
    if (status) {
        const statuses = status.split(',').map((s) => s.trim()).filter(Boolean);
        filter.status = statuses.length > 1 ? { $in: statuses } : statuses[0];
    }
    if (paymentStatus)
        filter.paymentStatus = paymentStatus;
    if (q)
        filter.bookingCode = { $regex: (0, regex_1.searchRegex)(q), $options: 'i' };
    const [items, total] = await Promise.all([
        Booking_1.Booking.find(filter)
            .populate('customer', CUSTOMER_FIELDS)
            .populate('driver', DRIVER_FIELDS)
            .populate('vehicle', VEHICLE_FIELDS)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit),
        Booking_1.Booking.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
}
async function getBooking(req, res) {
    const booking = await Booking_1.Booking.findById(req.params.id)
        .populate('customer', CUSTOMER_FIELDS)
        .populate('driver', DRIVER_FIELDS)
        .populate('vehicle', VEHICLE_FIELDS)
        .populate('partner', 'companyName ownerName phone');
    if (!booking) {
        res.status(404).json({ message: 'Booking not found' });
        return;
    }
    res.json(booking);
}
async function listAvailableDrivers(req, res) {
    const { mode } = req.query;
    const filter = { status: 'active', onlineStatus: 'online' };
    if (mode === 'ride')
        filter.serviceType = 'rider';
    if (mode === 'transport')
        filter.serviceType = 'transport';
    const drivers = await Driver_1.Driver.find(filter).select('name phone serviceType onlineStatus currentLocation rating').sort({ name: 1 });
    res.json(drivers);
}
async function assignBooking(req, res) {
    const { driverId, vehicleId } = req.body;
    if (!driverId) {
        res.status(400).json({ message: 'driverId is required' });
        return;
    }
    const booking = await Booking_1.Booking.findById(req.params.id);
    if (!booking) {
        res.status(404).json({ message: 'Booking not found' });
        return;
    }
    const previousDriver = booking.driver;
    booking.driver = new mongoose_1.Types.ObjectId(driverId);
    if (vehicleId)
        booking.vehicle = new mongoose_1.Types.ObjectId(vehicleId);
    if (booking.status === 'requested' || booking.status === 'no_rider_found') {
        booking.status = 'accepted';
        booking.acceptedAt = new Date();
    }
    booking.set('offer', { driver: null });
    booking.timeline.push({ status: 'accepted', at: new Date(), note: 'Manually assigned by admin' });
    await booking.save();
    // Keep the apps in sync: stop matching, move rider availability, notify both sides.
    (0, dispatch_1.stopDispatch)(booking.id);
    if (previousDriver && !previousDriver.equals(booking.driver)) {
        await Driver_1.Driver.updateOne({ _id: previousDriver, onlineStatus: 'on_trip' }, { onlineStatus: 'online' });
        (0, socket_1.leaveBookingRoom)(booking.id, { driverId: previousDriver });
    }
    await Driver_1.Driver.updateOne({ _id: booking.driver }, { onlineStatus: 'on_trip' });
    (0, socket_1.joinBookingRoom)(booking.id, { customerId: booking.customer, driverId: booking.driver });
    const rider = await Driver_1.Driver.findById(booking.driver).select('name rating photoUrl');
    (0, socket_1.emitBookingEvent)(booking.id, 'booking:rider_assigned', { bookingId: booking.id, rider, vehicle: booking.vehicle, etaMin: null }, ['customer']);
    (0, socket_1.emitBookingEvent)(booking.id, 'booking:status', { bookingId: booking.id, status: booking.status, timestamp: new Date().toISOString() }, ['customer', 'rider', 'admin']);
    await (0, notify_1.notifyUser)('driver', booking.driver, { title: 'Trip assigned', body: `Booking ${booking.bookingCode} was assigned to you`, data: { bookingId: booking.id, type: 'trip_assigned' } });
    await (0, audit_1.recordAudit)(req.admin, 'booking.assigned', 'Booking', booking.bookingCode, { driverId, vehicleId });
    const populated = await Booking_1.Booking.findById(booking.id)
        .populate('customer', CUSTOMER_FIELDS)
        .populate('driver', DRIVER_FIELDS)
        .populate('vehicle', VEHICLE_FIELDS);
    res.json(populated);
}
async function updateBookingStatus(req, res) {
    const { status, note, cancelledBy, reason } = req.body;
    if (!status) {
        res.status(400).json({ message: 'status is required' });
        return;
    }
    const booking = await Booking_1.Booking.findById(req.params.id);
    if (!booking) {
        res.status(404).json({ message: 'Booking not found' });
        return;
    }
    if (['accepted', 'arriving', 'arrived', 'started', 'in_transit', 'completed'].includes(status) && !booking.driver) {
        res.status(409).json({ message: 'Assign a rider before moving this booking to an active trip status' });
        return;
    }
    booking.status = status;
    if (status === 'cancelled') {
        booking.cancellation = {
            by: cancelledBy ?? 'admin',
            reason: reason ?? note ?? 'Cancelled by admin',
            chargedAmount: booking.cancellation?.chargedAmount ?? 0,
        };
    }
    booking.timeline.push({ status, at: new Date(), note });
    await booking.save();
    await (0, audit_1.recordAudit)(req.admin, 'booking.status_changed', 'Booking', booking.bookingCode, { status, note, reason });
    if (status === 'cancelled') {
        (0, dispatch_1.stopDispatch)(booking.id);
        if (booking.driver)
            await Driver_1.Driver.updateOne({ _id: booking.driver, onlineStatus: 'on_trip' }, { onlineStatus: 'online' });
        (0, socket_1.emitBookingEvent)(booking.id, 'booking:cancelled', { bookingId: booking.id, by: booking.cancellation?.by ?? 'admin', reason: booking.cancellation?.reason, charge: 0 }, ['customer', 'rider', 'admin']);
        (0, socket_1.leaveBookingRoom)(booking.id);
    }
    else {
        (0, socket_1.emitBookingEvent)(booking.id, 'booking:status', { bookingId: booking.id, status, timestamp: new Date().toISOString() }, ['customer', 'rider', 'admin']);
        if (status === 'requested')
            (0, dispatch_1.startDispatch)(booking.id);
    }
    const populated = await Booking_1.Booking.findById(booking.id)
        .populate('customer', CUSTOMER_FIELDS)
        .populate('driver', DRIVER_FIELDS)
        .populate('vehicle', VEHICLE_FIELDS);
    res.json(populated);
}
// Bookings that are still being dispatched or driven; they must be cancelled before they can be deleted.
const UNDELETABLE_STATUSES = ['scheduled', 'requested', ...Booking_1.ACTIVE_TRIP_STATUSES];
// DELETE /bookings/:id: removes a booking that has no money or support records attached
// (payments, refunds, wallet entries, coins, SOS, tickets stay for the accounts and audits).
async function deleteBooking(req, res) {
    const booking = await Booking_1.Booking.findById(req.params.id);
    if (!booking) {
        res.status(404).json({ message: 'Booking not found' });
        return;
    }
    if (UNDELETABLE_STATUSES.includes(booking.status)) {
        res.status(409).json({ message: `Cannot delete: this booking is ${booking.status.replace(/_/g, ' ')}. Cancel it first.` });
        return;
    }
    const ref = { booking: booking._id };
    const [payments, refunds, walletEntries, coins, sos, tickets] = await Promise.all([
        Payment_1.Payment.countDocuments(ref),
        Refund_1.Refund.countDocuments(ref),
        WalletTransaction_1.WalletTransaction.countDocuments({ referenceType: 'Booking', referenceId: booking._id }),
        CoinTransaction_1.CoinTransaction.countDocuments(ref),
        SosRequest_1.SosRequest.countDocuments(ref),
        Ticket_1.Ticket.countDocuments(ref),
    ]);
    const kept = [
        payments && 'payments',
        refunds && 'refunds',
        walletEntries && 'wallet entries',
        coins && 'coin rewards',
        sos && 'SOS alerts',
        tickets && 'support tickets',
    ].filter(Boolean);
    if (booking.paymentStatus === 'paid' || booking.paymentStatus === 'refunded' || kept.length) {
        res.status(409).json({ message: `Cannot delete: this booking has ${kept.length ? kept.join(', ') : 'a payment'} on record. It is kept for the accounts.` });
        return;
    }
    const ratings = await Rating_1.Rating.find(ref).select('driver customer ratedBy');
    await Promise.all([
        ChatMessage_1.ChatMessage.deleteMany(ref),
        // Only unpaid checkouts can be left (a paid one would have a payment record).
        GatewayOrder_1.GatewayOrder.deleteMany({ ...ref, status: { $ne: 'paid' } }),
        Rating_1.Rating.deleteMany(ref),
    ]);
    await booking.deleteOne();
    await Promise.all(ratings.map((r) => {
        if (r.ratedBy === 'customer')
            return r.driver ? (0, trips_1.refreshAverageRating)('driver', r.driver) : null;
        return r.customer ? (0, trips_1.refreshAverageRating)('customer', r.customer) : null;
    }));
    if (booking.status === 'completed') {
        await Promise.all([
            booking.driver ? Driver_1.Driver.updateOne({ _id: booking.driver, totalTrips: { $gt: 0 } }, { $inc: { totalTrips: -1 } }) : null,
            Customer_1.Customer.updateOne({ _id: booking.customer, totalBookings: { $gt: 0 } }, { $inc: { totalBookings: -1 } }),
        ]);
    }
    await (0, audit_1.recordAudit)(req.admin, 'booking.deleted', 'Booking', booking.bookingCode, {
        status: booking.status,
        mode: booking.mode,
        fare: booking.fare?.total ?? 0,
    });
    res.json({ message: 'Booking deleted' });
}
//# sourceMappingURL=bookings.controller.js.map