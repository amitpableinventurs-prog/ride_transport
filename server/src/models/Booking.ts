import { Schema, model, type InferSchemaType } from 'mongoose'

const bookingSchema = new Schema(
  {
    bookingCode: { type: String, required: true, unique: true },
    mode: { type: String, enum: ['ride', 'transport'], required: true },
    categoryKey: { type: String, required: true },
    customer: { type: Schema.Types.ObjectId, ref: 'Customer', required: true },
    driver: { type: Schema.Types.ObjectId, ref: 'Driver', default: null },
    vehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    partner: { type: Schema.Types.ObjectId, ref: 'TransportPartner', default: null },
    pickup: {
      address: String,
      lat: Number,
      lng: Number,
    },
    drop: {
      address: String,
      lat: Number,
      lng: Number,
    },
    goodsDetails: {
      description: String,
      weightKg: Number,
      notes: String,
    },
    status: {
      type: String,
      enum: ['requested', 'accepted', 'arriving', 'started', 'in_transit', 'completed', 'cancelled'],
      default: 'requested',
    },
    fare: {
      base: { type: Number, default: 0 },
      distance: { type: Number, default: 0 },
      time: { type: Number, default: 0 },
      waiting: { type: Number, default: 0 },
      night: { type: Number, default: 0 },
      platformFee: { type: Number, default: 0 },
      tax: { type: Number, default: 0 },
      discount: { type: Number, default: 0 },
      total: { type: Number, default: 0 },
    },
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

export type BookingDocument = InferSchemaType<typeof bookingSchema>
export const Booking = model('Booking', bookingSchema)
