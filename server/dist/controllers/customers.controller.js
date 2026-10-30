"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCustomers = listCustomers;
exports.updateCustomer = updateCustomer;
exports.deleteCustomer = deleteCustomer;
const AppNotification_1 = require("../models/AppNotification");
const Booking_1 = require("../models/Booking");
const CoinTransaction_1 = require("../models/CoinTransaction");
const Customer_1 = require("../models/Customer");
const Device_1 = require("../models/Device");
const GatewayOrder_1 = require("../models/GatewayOrder");
const OtpCode_1 = require("../models/OtpCode");
const Wallet_1 = require("../models/Wallet");
const WalletTransaction_1 = require("../models/WalletTransaction");
const socket_1 = require("../realtime/socket");
const audit_1 = require("../utils/audit");
const regex_1 = require("../utils/regex");
function parsePagination(req) {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
}
async function listCustomers(req, res) {
    const { page, limit, skip } = parsePagination(req);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const filter = {};
    if (status)
        filter.status = status;
    if (q) {
        const re = new RegExp((0, regex_1.searchRegex)(q), 'i');
        filter.$or = [{ name: re }, { email: re }, { phone: re }];
    }
    const [items, total] = await Promise.all([
        Customer_1.Customer.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Customer_1.Customer.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
}
// Status changes plus profile corrections (name, email, city, gender, date of birth).
async function updateCustomer(req, res) {
    const body = req.body;
    if (body.status !== undefined && !['active', 'suspended', 'blocked'].includes(body.status)) {
        res.status(400).json({ message: 'A valid status is required' });
        return;
    }
    if (body.gender !== undefined && !['male', 'female', 'other'].includes(body.gender)) {
        res.status(400).json({ message: 'gender must be male, female or other' });
        return;
    }
    const dob = body.dateOfBirth !== undefined ? new Date(body.dateOfBirth) : undefined;
    if (dob && Number.isNaN(dob.getTime())) {
        res.status(400).json({ message: 'dateOfBirth is not a valid date' });
        return;
    }
    const customer = await Customer_1.Customer.findById(req.params.id);
    if (!customer) {
        res.status(404).json({ message: 'Customer not found' });
        return;
    }
    if (body.status !== undefined)
        customer.status = body.status;
    if (body.name !== undefined)
        customer.name = String(body.name).trim().slice(0, 80);
    if (body.email !== undefined)
        customer.email = String(body.email).trim().toLowerCase() || undefined;
    if (body.city !== undefined)
        customer.city = String(body.city).trim().slice(0, 80) || undefined;
    if (body.gender !== undefined)
        customer.gender = body.gender;
    if (dob)
        customer.dateOfBirth = dob;
    try {
        await customer.save();
    }
    catch (err) {
        if (err.code === 11000) {
            res.status(409).json({ message: 'Another account already uses this email' });
            return;
        }
        throw err;
    }
    await (0, audit_1.recordAudit)(req.admin, body.status ? 'customer.status_changed' : 'customer.updated', 'Customer', `${customer.name} (${customer.email ?? customer.phone})`, body.status ? { status: body.status } : undefined);
    res.json(customer);
}
// Bookings still being dispatched or driven; they must be cancelled before the customer can be deleted.
const UNDELETABLE_BOOKING_STATUSES = ['scheduled', 'requested', ...Booking_1.ACTIVE_TRIP_STATUSES];
// DELETE /:id: removes the account with its wallet, coins, devices and notifications.
// Past bookings, payments, ratings, tickets and SOS records stay for the accounts and audits.
async function deleteCustomer(req, res) {
    const customer = await Customer_1.Customer.findById(req.params.id);
    if (!customer) {
        res.status(404).json({ message: 'Customer not found' });
        return;
    }
    const open = await Booking_1.Booking.findOne({ customer: customer._id, status: { $in: UNDELETABLE_BOOKING_STATUSES } }).select('bookingCode status');
    if (open) {
        res.status(409).json({ message: `Cannot delete: booking ${open.bookingCode} is ${open.status.replace(/_/g, ' ')}. Cancel it first.` });
        return;
    }
    const wallet = await Wallet_1.Wallet.findOne({ ownerType: 'customer', ownerId: customer._id });
    await Promise.all([
        wallet ? WalletTransaction_1.WalletTransaction.deleteMany({ wallet: wallet._id }) : null,
        CoinTransaction_1.CoinTransaction.deleteMany({ customer: customer._id }),
        Device_1.Device.deleteMany({ userType: 'customer', userId: customer._id }),
        AppNotification_1.AppNotification.deleteMany({ userType: 'customer', userId: customer._id }),
        // Only unpaid checkouts; a paid one belongs to a payment record.
        GatewayOrder_1.GatewayOrder.deleteMany({ ownerType: 'customer', ownerId: customer._id, status: { $ne: 'paid' } }),
        OtpCode_1.OtpCode.deleteMany({ purpose: 'app_login', destination: `customer:${customer.phone}` }),
        // People this customer referred keep their accounts; the link to the deleted referrer goes.
        Customer_1.Customer.updateMany({ referredBy: customer._id }, { $set: { referredBy: null } }),
    ]);
    if (wallet)
        await wallet.deleteOne();
    await customer.deleteOne();
    (0, socket_1.disconnectCustomer)(customer._id);
    await (0, audit_1.recordAudit)(req.admin, 'customer.deleted', 'Customer', `${customer.name || 'No name'} (${customer.phone})`, {
        walletBalance: wallet?.balance ?? 0,
        coins: customer.coins ?? 0,
        totalBookings: customer.totalBookings,
        deletionRequested: Boolean(customer.deletionRequestedAt),
    });
    res.json({ message: 'Customer deleted' });
}
//# sourceMappingURL=customers.controller.js.map