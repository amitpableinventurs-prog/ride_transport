"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Driver = void 0;
const mongoose_1 = require("mongoose");
const schemaOptions_1 = require("../utils/schemaOptions");
const personalProfile_1 = require("./personalProfile");
// Covers both sidebar entries "Riders" and "Drivers" (SRS section 9) — an
// individual ride-service driver not attached to a Transport Partner.
// serviceType: "rider" runs ride services (bike, auto, cab), "transport" runs goods delivery.
const driverSchema = new mongoose_1.Schema({
    // Empty until the user fills the Profile screen (SRS sign-up creates the account at OTP verify).
    name: { type: String, default: '', trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, required: true, index: true },
    ...personalProfile_1.personalProfileFields,
    serviceType: { type: String, enum: ['rider', 'transport'], required: true, default: 'rider' },
    approvalStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    rejectionReason: { type: String },
    onboarding: {
        riderType: { type: String, enum: ['individual', 'partner'] },
        partner: { type: mongoose_1.Schema.Types.ObjectId, ref: 'TransportPartner', default: null },
        vehicleType: { type: mongoose_1.Schema.Types.ObjectId, ref: 'VehicleType', default: null },
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
    assignedVehicle: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    rating: { type: Number, default: 0 },
    totalTrips: { type: Number, default: 0 },
    cancellations: { type: Number, default: 0 },
    earnings: { type: Number, default: 0 },
    // Set by DELETE /rider/account; an admin completes the deletion.
    deletionRequestedAt: { type: Date },
    deletionReason: { type: String },
}, { timestamps: true, toJSON: schemaOptions_1.idToJson });
driverSchema.index({ onlineStatus: 1, status: 1, approvalStatus: 1, 'currentLocation.lat': 1, 'currentLocation.lng': 1 });
exports.Driver = (0, mongoose_1.model)('Driver', driverSchema);
//# sourceMappingURL=Driver.js.map