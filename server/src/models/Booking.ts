import { Schema, model, type InferSchemaType } from 'mongoose'

// Lifecycle (SRS §6):
//   scheduled → requested (searching) → accepted → arrived → started (ride) / in_transit (transport) → completed
//   requested → no_rider_found (customer may retry); any status before start → cancelled.
// "arriving" is kept for bookings created before the app APIs existed.
export const BOOKING_STATUSES = [
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
] as const
export type BookingStatus = (typeof BOOKING_STATUSES)[number]

/** A rider is attached and the trip has not finished. */
export const ACTIVE_TRIP_STATUSES: BookingStatus[] = ['accepted', 'arriving', 'arrived', 'started', 'in_transit']
/** Booking still needs attention from the customer app (searching, trip running, etc.). */
export const OPEN_BOOKING_STATUSES: BookingStatus[] = ['requested', 'no_rider_found', ...ACTIVE_TRIP_STATUSES]

const pointSchema = {
  address: String,
  lat: Number,
  lng: Number,
}

// Transport drop points. The receiver gives the rider the stop OTP on delivery.
const stopSchema = new Schema({
  address: String,
  lat: Number,
  lng: Number,
  contactName: String,
  contactPhone: String,
  otp: String,
  status: { type: String, enum: ['pending', 'completed'], default: 'pending' },
  completedAt: Date,
  podUrl: String,
})

const bookingSchema = new Schema(
  {
    bookingCode: { type: String, required: true, unique: true },
    mode: { type: String, enum: ['ride', 'transport'], required: true },
    categoryKey: { type: String, required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    driver: { type: Schema.Types.ObjectId, ref: 'Driver', default: null },
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    partner: { type: Schema.Types.ObjectId, ref: 'TransportPartner', default: null },
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
    status: { type: String, enum: BOOKING_STATUSES, default: 'requested' },
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
    serviceArea: { type: Schema.Types.ObjectId, ref: 'ServiceArea', default: null },

    // Ride start OTP (or transport pickup OTP) the customer reads out to the rider.
    startOtp: { type: String },

    // Dispatch: the booking is offered to one rider at a time.
    offer: {
      driver: { type: Schema.Types.ObjectId, ref: 'Driver', default: null },
      offeredAt: Date,
      expiresAt: Date,
    },
    rejectedBy: { type: [Schema.Types.ObjectId], default: [] },
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
  },
  { timestamps: true },
)

bookingSchema.index({ customer: 1, createdAt: -1 })
bookingSchema.index({ driver: 1, createdAt: -1 })
bookingSchema.index({ status: 1, scheduledAt: 1 })

export type BookingDocument = InferSchemaType<typeof bookingSchema>
export const Booking = model('Booking', bookingSchema)
