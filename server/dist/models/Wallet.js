"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Wallet = void 0;
const mongoose_1 = require("mongoose");
const walletSchema = new mongoose_1.Schema({
    ownerType: { type: String, enum: ['customer', 'driver', 'partner'], required: true },
    ownerId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    balance: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' },
}, { timestamps: true });
walletSchema.index({ ownerType: 1, ownerId: 1 }, { unique: true });
exports.Wallet = (0, mongoose_1.model)('Wallet', walletSchema);
//# sourceMappingURL=Wallet.js.map