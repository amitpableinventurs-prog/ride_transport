"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Customer = exports.SAVED_PLACE_LABELS = void 0;
const mongoose_1 = require("mongoose");
const schemaOptions_1 = require("../utils/schemaOptions");
const personalProfile_1 = require("./personalProfile");
exports.SAVED_PLACE_LABELS = ['home', 'work', 'other'];
const savedPlaceSchema = new mongoose_1.Schema({
    label: { type: String, enum: exports.SAVED_PLACE_LABELS, required: true },
    name: { type: String, trim: true },
    address: { type: String, required: true, trim: true },
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
}, { toJSON: schemaOptions_1.idToJson });
const customerSchema = new mongoose_1.Schema({
    // Empty until the user fills the Profile screen (SRS sign-up creates the account at OTP verify).
    name: { type: String, default: '', trim: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, required: true, index: true },
    ...personalProfile_1.personalProfileFields,
    status: { type: String, enum: ['active', 'suspended', 'blocked'], default: 'active' },
    city: { type: String },
    totalBookings: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    savedPlaces: { type: [savedPlaceSchema], default: [] },
    // SOS contacts (max 3). emergencyContact mirrors the first one for the Profile screen.
    emergencyContacts: { type: [personalProfile_1.emergencyContactSchema], default: [] },
    // Refer & Earn: own shareable code, who referred this customer, and whether the first-ride reward was paid.
    referralCode: { type: String, unique: true, sparse: true, uppercase: true, trim: true },
    referredBy: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Customer', default: null },
    referralRewardedAt: { type: Date },
    // Fixed 4-digit Ride PIN, unique per customer, set once at first login and used as the start OTP of every trip (see ensureRidePin).
    ridePin: { type: String },
    // anzcabs Coins balance (ledger in CoinTransaction).
    coins: { type: Number, default: 0 },
    // Settings screen. Trip and payment notifications are always sent; offers can be switched off.
    notificationPrefs: {
        offers: { type: Boolean, default: true },
    },
    deletionRequestedAt: { type: Date },
    deletionReason: { type: String },
}, { timestamps: true, toJSON: schemaOptions_1.idToJson });
// No two customers share a Ride PIN; accounts without one yet are left out of the index.
customerSchema.index({ ridePin: 1 }, { unique: true, partialFilterExpression: { ridePin: { $type: 'string' } } });
exports.Customer = (0, mongoose_1.model)('Customer', customerSchema);
//# sourceMappingURL=Customer.js.map