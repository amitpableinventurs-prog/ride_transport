"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWallet = getWallet;
exports.topUpWallet = topUpWallet;
exports.createPaymentOrder = createPaymentOrder;
exports.verifyPayment = verifyPayment;
exports.getPaymentStatus = getPaymentStatus;
const Booking_1 = require("../../models/Booking");
const WalletTransaction_1 = require("../../models/WalletTransaction");
const gatewayPayments_1 = require("../../services/gatewayPayments");
const http_1 = require("../../utils/http");
const wallet_1 = require("../../utils/wallet");
const MIN_TOPUP = 10;
const MAX_TOPUP = 10_000;
// GET /wallet
async function getWallet(req, res) {
    const { page, limit, skip } = (0, http_1.parsePagination)(req);
    const wallet = await (0, wallet_1.getOrCreateWallet)('customer', req.appUser.doc._id);
    const [transactions, total] = await Promise.all([
        WalletTransaction_1.WalletTransaction.find({ wallet: wallet._id }).sort({ createdAt: -1 }).skip(skip).limit(limit),
        WalletTransaction_1.WalletTransaction.countDocuments({ wallet: wallet._id }),
    ]);
    // A negative balance is unpaid cancellation charges.
    res.json({ balance: wallet.balance, currency: wallet.currency, dues: Math.max(0, -wallet.balance), transactions: { items: transactions, total, page, limit } });
}
// POST /wallet/topup
async function topUpWallet(req, res) {
    const amount = (0, http_1.parseAmount)(req.body.amount, 'amount', { min: MIN_TOPUP, max: MAX_TOPUP });
    res.status(201).json(await (0, gatewayPayments_1.createGatewayOrder)({ purpose: 'wallet_topup', ownerType: 'customer', ownerId: req.appUser.doc._id, amount }));
}
// POST /payments/order: pay a completed booking online.
async function createPaymentOrder(req, res) {
    const booking = await Booking_1.Booking.findOne({ _id: (0, http_1.requireObjectId)(req.body.bookingId, 'bookingId'), customer: req.appUser.doc._id });
    if (!booking)
        throw new http_1.HttpError(404, 'Booking not found');
    if (booking.status !== 'completed')
        throw new http_1.HttpError(409, 'Payment opens once the trip is completed');
    if (booking.paymentStatus !== 'pending')
        throw new http_1.HttpError(409, 'This booking is already paid');
    res.status(201).json(await (0, gatewayPayments_1.createGatewayOrder)({ purpose: 'booking', ownerType: 'customer', ownerId: req.appUser.doc._id, amount: booking.fare?.total ?? 0, booking: booking._id }));
}
// POST /payments/verify: booking payments and wallet top-ups.
async function verifyPayment(req, res) {
    res.json(await (0, gatewayPayments_1.verifyGatewayPayment)({ type: 'customer', id: req.appUser.doc._id }, req.body));
}
// GET /payments/orders/:orderId: poll after checkout; a paid order is applied even if /payments/verify never came.
async function getPaymentStatus(req, res) {
    res.json(await (0, gatewayPayments_1.getGatewayOrderStatus)({ type: 'customer', id: req.appUser.doc._id }, (0, http_1.requireString)(req.params.orderId, 'orderId')));
}
//# sourceMappingURL=payments.controller.js.map