"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listDrivers = listDrivers;
exports.updateDriver = updateDriver;
exports.deleteDriver = deleteDriver;
const Driver_1 = require("../models/Driver");
const Booking_1 = require("../models/Booking");
const Document_1 = require("../models/Document");
const OtpCode_1 = require("../models/OtpCode");
const Vehicle_1 = require("../models/Vehicle");
const Wallet_1 = require("../models/Wallet");
const WalletTransaction_1 = require("../models/WalletTransaction");
const socket_1 = require("../realtime/socket");
const dispatch_1 = require("../services/dispatch");
const audit_1 = require("../utils/audit");
const regex_1 = require("../utils/regex");
function parsePagination(req) {
    const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20));
    return { page, limit, skip: (page - 1) * limit };
}
// Backs both the "Riders" and "Drivers" nav pages (SRS section 9) — a single
// Driver collection distinguished by serviceType (rider | transport), filtered via ?serviceType=.
async function listDrivers(req, res) {
    const { page, limit, skip } = parsePagination(req);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const serviceType = typeof req.query.serviceType === 'string' ? req.query.serviceType : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const approvalStatus = typeof req.query.approvalStatus === 'string' ? req.query.approvalStatus : undefined;
    const filter = {};
    if (serviceType)
        filter.serviceType = serviceType;
    if (status)
        filter.status = status;
    if (approvalStatus)
        filter.approvalStatus = approvalStatus;
    if (q) {
        const re = new RegExp((0, regex_1.searchRegex)(q), 'i');
        filter.$or = [{ name: re }, { email: re }, { phone: re }];
    }
    const [items, total] = await Promise.all([
        Driver_1.Driver.find(filter).populate('assignedVehicle', 'registrationNumber model').sort({ createdAt: -1 }).skip(skip).limit(limit),
        Driver_1.Driver.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
}
async function updateDriver(req, res) {
    const driver = await Driver_1.Driver.findById(req.params.id);
    if (!driver) {
        res.status(404).json({ message: 'Driver not found' });
        return;
    }
    const body = req.body;
    const wasVerified = driver.approvalStatus === 'verified';
    if (body.approvalStatus !== undefined) {
        driver.approvalStatus = body.approvalStatus;
        // Shown to the rider in the app's approval status screen.
        driver.rejectionReason = body.approvalStatus === 'rejected' ? body.rejectionReason?.trim() || undefined : undefined;
    }
    if (body.status !== undefined)
        driver.status = body.status;
    // Profile corrections made while reviewing the account.
    if (body.name !== undefined)
        driver.name = String(body.name).trim().slice(0, 80);
    if (body.email !== undefined)
        driver.email = String(body.email).trim().toLowerCase() || undefined;
    if (body.gender !== undefined) {
        if (!['male', 'female', 'other'].includes(body.gender)) {
            res.status(400).json({ message: 'gender must be male, female or other' });
            return;
        }
        driver.gender = body.gender;
    }
    if (body.dateOfBirth !== undefined) {
        const dob = new Date(body.dateOfBirth);
        if (Number.isNaN(dob.getTime())) {
            res.status(400).json({ message: 'dateOfBirth is not a valid date' });
            return;
        }
        driver.dateOfBirth = dob;
    }
    try {
        await driver.save();
    }
    catch (err) {
        if (err.code === 11000) {
            res.status(409).json({ message: 'Another account already uses this email' });
            return;
        }
        throw err;
    }
    // Approving the rider also puts their own vehicles into service once the vehicle documents are verified;
    // without an active vehicle the rider app cannot go online. Blocked vehicles stay blocked.
    let vehiclesActivated = 0;
    if (body.approvalStatus === 'verified' && !wasVerified) {
        const result = await Vehicle_1.Vehicle.updateMany({ ownerType: 'driver', ownerId: driver._id, status: 'inactive', documentsStatus: 'verified' }, { $set: { status: 'active' } });
        vehiclesActivated = result.modifiedCount;
    }
    await driver.populate('assignedVehicle', 'registrationNumber model');
    const action = body.approvalStatus ? 'driver.approval_changed' : body.status ? 'driver.status_changed' : 'driver.updated';
    await (0, audit_1.recordAudit)(req.admin, action, 'Driver', `${driver.name} (${driver.phone})`, {
        approvalStatus: body.approvalStatus,
        status: body.status,
        ...(vehiclesActivated ? { vehiclesActivated } : {}),
    });
    res.json(driver);
}
// Removes a rider or driver account with their vehicles, documents and wallet.
// Past bookings, ratings and settlements stay as history (the rider shows as unassigned there).
async function deleteDriver(req, res) {
    const driver = await Driver_1.Driver.findById(req.params.id);
    if (!driver) {
        res.status(404).json({ message: 'Driver not found' });
        return;
    }
    const activeTrip = await Booking_1.Booking.findOne({ driver: driver._id, status: { $in: Booking_1.ACTIVE_TRIP_STATUSES } }).select('bookingCode');
    if (activeTrip) {
        res.status(409).json({ message: `Cannot delete: this account is on an active trip (${activeTrip.bookingCode}). Try again after it ends.` });
        return;
    }
    const vehicles = await Vehicle_1.Vehicle.find({ ownerType: 'driver', ownerId: driver._id }).select('_id');
    const vehicleIds = vehicles.map((v) => v._id);
    const wallet = await Wallet_1.Wallet.findOne({ ownerType: 'driver', ownerId: driver._id });
    await Promise.all([
        Document_1.DocumentRecord.deleteMany({ $or: [{ ownerType: 'driver', ownerId: driver._id }, { ownerType: 'vehicle', ownerId: { $in: vehicleIds } }] }),
        // Other drivers who were matched with one of these vehicles lose the match.
        Driver_1.Driver.updateMany({ assignedVehicle: { $in: vehicleIds } }, { $set: { assignedVehicle: null } }),
        wallet ? WalletTransaction_1.WalletTransaction.deleteMany({ wallet: wallet._id }) : null,
        OtpCode_1.OtpCode.deleteMany({ purpose: 'app_login', destination: driver.phone }),
    ]);
    await Promise.all([Vehicle_1.Vehicle.deleteMany({ _id: { $in: vehicleIds } }), wallet ? wallet.deleteOne() : null]);
    await driver.deleteOne();
    // A request on offer to this rider goes to the next one at once instead of waiting for the offer to time out.
    (0, socket_1.removeLiveRider)(driver._id);
    (0, socket_1.disconnectRider)(driver._id);
    const offered = await Booking_1.Booking.find({ status: 'requested', 'offer.driver': driver._id }).select('_id');
    await Promise.all(offered.map((b) => (0, dispatch_1.withdrawOffer)(b.id, driver.id).catch((err) => console.error('[drivers] offer release failed', b.id, err))));
    await (0, audit_1.recordAudit)(req.admin, 'driver.deleted', 'Driver', `${driver.name || 'No name'} (${driver.phone})`, {
        serviceType: driver.serviceType,
        vehicles: vehicleIds.length,
        walletBalance: wallet?.balance ?? 0,
    });
    res.json({ message: 'Account deleted' });
}
//# sourceMappingURL=drivers.controller.js.map