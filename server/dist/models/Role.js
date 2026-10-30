"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Role = void 0;
const mongoose_1 = require("mongoose");
const rbac_1 = require("../types/rbac");
const roleSchema = new mongoose_1.Schema({
    key: { type: String, required: true, unique: true, enum: rbac_1.ROLE_KEYS },
    name: { type: String, required: true },
    description: { type: String, required: true },
    permissions: [{ type: String, enum: rbac_1.PERMISSION_KEYS }],
    isSystem: { type: Boolean, default: true },
}, { timestamps: true });
exports.Role = (0, mongoose_1.model)('Role', roleSchema);
//# sourceMappingURL=Role.js.map