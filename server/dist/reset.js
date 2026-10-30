"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Clears all seeded demo / transactional data so the admin panel reflects only
// the real data created through the mobile apps, while keeping the platform
// configuration the apps and the admin login depend on.
//
//   npm run reset
//
// KEEPS (configuration / access):
//   Roles, Admins (login accounts), Settings, VehicleTypes, ServiceCategories,
//   ServiceAreas, PricingRules, CommissionRules, NotificationTemplates, CmsPages
//
// WIPES (demo entities + their activity):
//   Customers, Drivers (Riders + Drivers), TransportPartners, Vehicles,
//   Bookings, Payments, Refunds, Ratings, Wallets, WalletTransactions, Tickets,
//   SosRequests, Settlements, Withdrawals, CoinTransactions, IncentiveSchemes,
//   DocumentRecords, ChatMessages, AppNotifications, Devices, GatewayOrders,
//   OtpCodes, RevokedTokens, AuditLogs, the seeded DashboardSnapshot,
//   NotificationBroadcasts, Coupons and Banners.
const db_1 = require("./config/db");
const env_1 = require("./config/env");
const mongoose_1 = __importDefault(require("mongoose"));
// Demo entities + their activity — safe to delete, recreated by the apps.
const Customer_1 = require("./models/Customer");
const Driver_1 = require("./models/Driver");
const TransportPartner_1 = require("./models/TransportPartner");
const Vehicle_1 = require("./models/Vehicle");
const Booking_1 = require("./models/Booking");
const Payment_1 = require("./models/Payment");
const Refund_1 = require("./models/Refund");
const Rating_1 = require("./models/Rating");
const Wallet_1 = require("./models/Wallet");
const WalletTransaction_1 = require("./models/WalletTransaction");
const Ticket_1 = require("./models/Ticket");
const SosRequest_1 = require("./models/SosRequest");
const Settlement_1 = require("./models/Settlement");
const Withdrawal_1 = require("./models/Withdrawal");
const CoinTransaction_1 = require("./models/CoinTransaction");
const IncentiveScheme_1 = require("./models/IncentiveScheme");
const Document_1 = require("./models/Document");
const ChatMessage_1 = require("./models/ChatMessage");
const AppNotification_1 = require("./models/AppNotification");
const Device_1 = require("./models/Device");
const GatewayOrder_1 = require("./models/GatewayOrder");
const OtpCode_1 = require("./models/OtpCode");
const RevokedToken_1 = require("./models/RevokedToken");
const AuditLog_1 = require("./models/AuditLog");
const DashboardSnapshot_1 = require("./models/DashboardSnapshot");
const NotificationBroadcast_1 = require("./models/NotificationBroadcast");
const Coupon_1 = require("./models/Coupon");
const Banner_1 = require("./models/Banner");
// Collections that are left untouched so the platform keeps working.
// Typed loosely: the models have different, incompatible generic signatures,
// and this script only needs countDocuments/deleteMany on each.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const modelsToClear = [
    ['Customer', Customer_1.Customer],
    ['Driver (Riders + Drivers)', Driver_1.Driver],
    ['TransportPartner', TransportPartner_1.TransportPartner],
    ['Vehicle', Vehicle_1.Vehicle],
    ['Booking', Booking_1.Booking],
    ['Payment', Payment_1.Payment],
    ['Refund', Refund_1.Refund],
    ['Rating', Rating_1.Rating],
    ['Wallet', Wallet_1.Wallet],
    ['WalletTransaction', WalletTransaction_1.WalletTransaction],
    ['Ticket', Ticket_1.Ticket],
    ['SosRequest', SosRequest_1.SosRequest],
    ['Settlement', Settlement_1.Settlement],
    ['Withdrawal', Withdrawal_1.Withdrawal],
    ['CoinTransaction', CoinTransaction_1.CoinTransaction],
    ['IncentiveScheme', IncentiveScheme_1.IncentiveScheme],
    ['DocumentRecord', Document_1.DocumentRecord],
    ['ChatMessage', ChatMessage_1.ChatMessage],
    ['AppNotification', AppNotification_1.AppNotification],
    ['Device', Device_1.Device],
    ['GatewayOrder', GatewayOrder_1.GatewayOrder],
    ['OtpCode', OtpCode_1.OtpCode],
    ['RevokedToken', RevokedToken_1.RevokedToken],
    ['AuditLog', AuditLog_1.AuditLog],
    ['DashboardSnapshot', DashboardSnapshot_1.DashboardSnapshot],
    ['NotificationBroadcast', NotificationBroadcast_1.NotificationBroadcast],
    ['Coupon', Coupon_1.Coupon],
    ['Banner', Banner_1.Banner],
];
async function reset() {
    if (env_1.env.isProduction) {
        throw new Error('Refusing to run the data reset with NODE_ENV=production.');
    }
    try {
        await (0, db_1.connectDb)();
        console.log(`[reset] connected to ${env_1.env.mongoUri}`);
        console.log('[reset] clearing demo / transactional data...');
        let total = 0;
        for (const [label, model] of modelsToClear) {
            const before = await model.countDocuments({});
            const result = await model.deleteMany({});
            total += result.deletedCount ?? 0;
            console.log(`[reset] ${label.padEnd(28)} removed ${String(result.deletedCount ?? 0).padStart(5)} (was ${before})`);
        }
        console.log(`[reset] done. Removed ${total} documents. Kept roles, admins, settings, categories, areas, pricing, commissions, templates and CMS pages.`);
    }
    finally {
        await mongoose_1.default.disconnect();
    }
}
reset().catch((err) => {
    console.error('[reset] failed', err);
    process.exit(1);
});
//# sourceMappingURL=reset.js.map