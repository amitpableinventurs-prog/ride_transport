"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDb = connectDb;
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("./env");
const schemaOptions_1 = require("../utils/schemaOptions");
// Every API response keys records by `id` (the frontend and Flutter clients never
// see `_id`). Schemas that set their own toJSON (e.g. Admin) still override this.
mongoose_1.default.set('toJSON', schemaOptions_1.idToJson);
async function connectDb() {
    mongoose_1.default.set('strictQuery', true);
    await mongoose_1.default.connect(env_1.env.mongoUri, {
        maxPoolSize: env_1.env.dbPoolSize,
        minPoolSize: Math.min(5, env_1.env.dbPoolSize),
        // Fail fast instead of hanging every request when the database is unreachable.
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        maxIdleTimeMS: 60000,
    });
    // Hide the password: Atlas URIs carry credentials.
    console.log(`[db] connected to ${env_1.env.mongoUri.replace(/\/\/[^@/]*@/, '//***@')}`);
    // Super Admin has full access, so it also gets permissions added after the database was seeded (e.g. error_logs.*).
    const { Role } = await Promise.resolve().then(() => __importStar(require('../models/Role')));
    const { ALL_PERMISSIONS } = await Promise.resolve().then(() => __importStar(require('../utils/roles')));
    await Role.updateOne({ key: 'super_admin' }, { $addToSet: { permissions: { $each: ALL_PERMISSIONS } } });
    // App users sign up with a phone number only, so email moved from a plain
    // unique index to a sparse one. syncIndexes swaps the old index on existing DBs.
    const { Customer } = await Promise.resolve().then(() => __importStar(require('../models/Customer')));
    const { Driver } = await Promise.resolve().then(() => __importStar(require('../models/Driver')));
    const { TransportPartner } = await Promise.resolve().then(() => __importStar(require('../models/TransportPartner')));
    // Ride PINs became unique after some were given out: a shared PIN is cleared from all but the oldest account
    // (those get a new one at their next login or booking), so the unique index can be built.
    const sharedPins = await Customer.aggregate([
        { $match: { ridePin: { $type: 'string' } } },
        { $sort: { createdAt: 1 } },
        { $group: { _id: '$ridePin', ids: { $push: '$_id' }, n: { $sum: 1 } } },
        { $match: { n: { $gt: 1 } } },
    ]);
    for (const { ids } of sharedPins)
        await Customer.updateMany({ _id: { $in: ids.slice(1) } }, { $unset: { ridePin: 1 } });
    await Promise.all([Customer.syncIndexes(), Driver.syncIndexes(), TransportPartner.syncIndexes()]);
    // Partners created before partner codes existed get one (riders enter it during onboarding).
    const { generatePartnerCode } = await Promise.resolve().then(() => __importStar(require('../models/TransportPartner')));
    for (const partner of await TransportPartner.find({ partnerCode: { $exists: false } }).select('_id')) {
        await TransportPartner.updateOne({ _id: partner._id }, { partnerCode: generatePartnerCode() });
    }
}
//# sourceMappingURL=db.js.map