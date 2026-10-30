"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Admin = void 0;
const mongoose_1 = require("mongoose");
const rbac_1 = require("../types/rbac");
const schemaOptions_1 = require("../utils/schemaOptions");
const adminSchema = new mongoose_1.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, required: true },
    passwordHash: { type: String, required: true },
    role: { type: String, required: true, enum: rbac_1.ROLE_KEYS },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    avatarColor: { type: String, default: '#1f2f52' },
    lastLoginAt: { type: Date, default: null },
}, { timestamps: true, toJSON: schemaOptions_1.idToJson });
exports.Admin = (0, mongoose_1.model)('Admin', adminSchema);
//# sourceMappingURL=Admin.js.map