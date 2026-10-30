"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.personalProfileFields = exports.emergencyContactSchema = exports.GENDERS = void 0;
const mongoose_1 = require("mongoose");
exports.GENDERS = ['male', 'female', 'other'];
exports.emergencyContactSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true },
}, { _id: false });
// Personal details collected on the mobile app's Profile screen.
// Shared by Customer and Driver (partners register as a company instead).
exports.personalProfileFields = {
    gender: { type: String, enum: exports.GENDERS },
    dateOfBirth: { type: Date },
    emergencyContact: { type: exports.emergencyContactSchema, default: undefined },
    photoUrl: { type: String },
    language: { type: String, default: 'en' },
};
//# sourceMappingURL=personalProfile.js.map