import { Schema, model, type InferSchemaType } from 'mongoose'
import { idToJson } from '../utils/schemaOptions'
import { personalProfileFields } from './personalProfile'

// Covers both sidebar entries "Riders" and "Drivers" (SRS section 9) — an
// individual ride-service driver not attached to a Transport Partner.
// serviceType distinguishes two-wheeler/auto "riders" from cab "drivers".
const driverSchema = new Schema(
  {
    // Empty until the user fills the Profile screen (SRS sign-up creates the account at OTP verify).
    name: { type: String, default: '', trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, required: true, index: true },
    ...personalProfileFields,
    serviceType: { type: String, enum: ['rider', 'driver'], required: true, default: 'rider' },
    approvalStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    rejectionReason: { type: String },
    onboarding: {
      riderType: { type: String, enum: ['individual', 'partner'] },
      partner: { type: Schema.Types.ObjectId, ref: 'TransportPartner', default: null },
      vehicleType: { type: Schema.Types.ObjectId, ref: 'VehicleType', default: null },
      services: { type: [String], default: undefined },
      // "Do you have a driving licence?": false limits the rider to delivery (transport) services.
      hasLicense: { type: Boolean },
      completedAt: { type: Date },
    },
    lastSelfieAt: { type: Date },
    selfieUrl: { type: String },
    status: { type: String, enum: ['active', 'suspended', 'blocked'], default: 'active' },
    onlineStatus: { type: String, enum: ['offline', 'online', 'busy', 'on_trip'], default: 'offline' },
    currentLocation: {
      lat: Number,
      lng: Number,
      heading: Number,
      speed: Number,
      updatedAt: Date,
    },
    assignedVehicle: { type: Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    rating: { type: Number, default: 0 },
    totalTrips: { type: Number, default: 0 },
    cancellations: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },
  },
  { timestamps: true, toJSON: idToJson },
)

export type DriverDocument = InferSchemaType<typeof driverSchema>
export const Driver = model('Driver', driverSchema)
