"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransportPartner = void 0;
exports.generatePartnerCode = generatePartnerCode;
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = require("mongoose");
function generatePartnerCode() {
    return `P${crypto_1.default.randomBytes(4).toString('hex').toUpperCase().slice(0, 6)}`;
}
const transportPartnerSchema = new mongoose_1.Schema({
    companyName: { type: String, required: true },
    ownerName: { type: String, required: true },
    email: { type: String, unique: true, sparse: true, lowercase: true, trim: true },
    phone: { type: String, required: true, index: true },
    // Riders enter this code during onboarding to join the partner's fleet.
    partnerCode: { type: String, unique: true, sparse: true, uppercase: true },
    businessRegNo: { type: String },
    taxId: { type: String },
    approvalStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending' },
    status: { type: String, enum: ['active', 'suspended', 'blocked'], default: 'active' },
    vehicleCount: { type: Number, default: 0 },
    driverCount: { type: Number, default: 0 },
}, { timestamps: true });
transportPartnerSchema.pre('validate', function (next) {
    if (!this.partnerCode)
        this.partnerCode = generatePartnerCode();
    next();
});
exports.TransportPartner = (0, mongoose_1.model)('TransportPartner', transportPartnerSchema);
//# sourceMappingURL=TransportPartner.js.map