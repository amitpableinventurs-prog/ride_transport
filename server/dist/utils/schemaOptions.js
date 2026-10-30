"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.idToJson = void 0;
// Express serializes Mongoose documents via toJSON(), which by default keeps
// `_id` and drops the `id` virtual — but the frontend types (AdminUser,
// Customer, Driver, ...) all key off `id`. Apply this to any schema whose
// documents are sent straight to the client.
exports.idToJson = {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret) => {
        delete ret._id;
        return ret;
    },
};
//# sourceMappingURL=schemaOptions.js.map