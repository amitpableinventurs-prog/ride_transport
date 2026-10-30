"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Booking = exports.OPEN_BOOKING_STATUSES = exports.ACTIVE_TRIP_STATUSES = exports.BOOKING_STATUSES = void 0;
const mongoose_1 = require("mongoose");
// Lifecycle (SRS §6):
//   scheduled → requested (searching) → accepted → arrived → started (ride) / in_transit (transport) → completed
//   requested → no_rider_found (customer may retry); any status before start → cancelled.
// "arriving" is kept for bookings created before the app APIs existed.
exports.BOOKING_STATUSES = [
    'scheduled',
    'requested',
    'no_rider_found',
    'accepted',
    'arriving',
    'arrived',
    'started',
    'in_transit',
    'completed',
    'cancelled',
];
/** A rider is attached and the trip has not finished. */
exports.ACTIVE_TRIP_STATUSES = ['accepted', 'arriving', 'arrived', 'started', 'in_transit'];
/** Booking still needs attention from the customer app (searching, trip running, etc.). */
exports.OPEN_BOOKING_STATUSES = ['requested', 'no_rider_found', ...exports.ACTIVE_TRIP_STATUSES];
const pointSchema = {
    address: String,
    lat: Number,
    lng: Number,
};
// Transport drop points. The receiver gives the rider the stop OTP on delivery.
const stopSchema = new mongoose_1.Schema({
    address: String,
    lat: Number,
    lng: Number,
    contactName: String,
    contactPhone: String,
    otp: String,
    status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
    completedAt: Date,
    podUrl: String,
});
const bookingSchema = new mongoose_1.Schema({
    bookingCode: { type: String, required: true, unique: true },
    mode: { type: String, enum: ['ride', 'transport'], required: true },
    categoryKey: { type: String, required: true },
    customer: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Customer', required: true },
    driver: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Driver', default: null },
    vehicle: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    partner: { type: mongoose_1.Schema.Types.ObjectId, ref: 'TransportPartner', default: null },
    pickup: pointSchema,
    // Final destination. For transport this mirrors the last stop.
    drop: pointSchema,
    stops: { type: [stopSchema], default: [] },
    goodsDetails: {
        description: String,
        weightKg: Number,
        notes: String,
        needsLoading: Boolean,
    },
    goodsPhotoUrl: String,
    status: { type: String, enum: exports.BOOKING_STATUSES, default: 'requested' },
    scheduledAt: { type: Date, default: null },
    fare: {
        base: { type: Number, default: 0 },
        distance: { type: Number, default: 0 },
        time: { type: Number, default: 0 },
        waiting: { type: Number, default: 0 },
        night: { type: Number, default: 0 },
        extraStops: { type: Number, default: 0 },
        loading: { type: Number, default: 0 },
        platformFee: { type: Number, default: 0 },
        tax: { type: Number, default: 0 },
        discount: { type: Number, default: 0 },
        tip: { type: Number, default: 0 },
        total: { type: Number, default: 0 },
    },
    couponCode: { type: String },
    distanceKm: { type: Number, default: 0 },
    durationMin: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    paymentMethod: { type: String, enum: ['cash', 'upi', 'card', 'wallet', 'netbanking'], default: 'cash' },
    cancellation: {
        by: { type: String, enum: ['customer', 'driver', 'admin'] },
        reason: String,
        chargedAmount: Number,
    },
    serviceArea: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ServiceArea', default: null },
    // Ride start OTP (or transport pickup OTP) the customer reads out to the rider.
    startOtp: { type: String },
    // Dispatch: the booking is offered to one rider at a time.
    offer: {
        driver: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Driver', default: null },
        offeredAt: Date,
        expiresAt: Date,
    },
    rejectedBy: { type: [mongoose_1.Schema.Types.ObjectId], default: [] },
    dispatchAttempts: { type: Number, default: 0 },
    acceptedAt: Date,
    arrivedAt: Date,
    startedAt: Date,
    completedAt: Date,
    settlement: {
        commission: { type: Number, default: 0 },
        riderEarning: { type: Number, default: 0 },
    },
    ratedByCustomer: { type: Boolean, default: false },
    ratedByRider: { type: Boolean, default: false },
    shareToken: { type: String, index: { unique: true, sparse: true } },
    timeline: [
        {
            status: String,
            at: { type: Date, default: Date.now },
            note: String,
        },
    ],
}, { timestamps: true });
bookingSchema.index({ customer: 1, createdAt: -1 });
bookingSchema.index({ driver: 1, createdAt: -1 });
bookingSchema.index({ status: 1, scheduledAt: 1 });
bookingSchema.index({ status: 1, 'offer.driver': 1, 'offer.expiresAt': 1 });
bookingSchema.index({ customer: 1, status: 1 });
bookingSchema.index({ driver: 1, status: 1 });
exports.Booking = (0, mongoose_1.model)('Booking', bookingSchema);
//# sourceMappingURL=Booking.js.map