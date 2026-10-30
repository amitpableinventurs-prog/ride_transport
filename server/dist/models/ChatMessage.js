"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatMessage = void 0;
const mongoose_1 = require("mongoose");
// In-trip chat
const chatMessageSchema = new mongoose_1.Schema({
    booking: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    from: { type: String, enum: ['customer', 'driver'], required: true },
    senderId: { type: mongoose_1.Schema.Types.ObjectId, required: true },
    text: { type: String, required: true },
}, { timestamps: true });
exports.ChatMessage = (0, mongoose_1.model)('ChatMessage', chatMessageSchema);
//# sourceMappingURL=ChatMessage.js.map