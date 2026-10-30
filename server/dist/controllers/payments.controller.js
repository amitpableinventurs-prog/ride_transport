"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPayments = listPayments;
const Payment_1 = require("../models/Payment");
const Booking_1 = require("../models/Booking");
const regex_1 = require("../utils/regex");
function parsePagination(query) {
    const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10) || 20));
    return { page, pageSize };
}
async function listPayments(req, res) {
    const query = req.query;
    const { status, method, q } = query;
    const filter = {};
    if (status)
        filter.status = status;
    if (method)
        filter.method = method;
    if (q && q.trim()) {
        const matchingBookings = await Booking_1.Booking.find({ bookingCode: { $regex: (0, regex_1.searchRegex)(q), $options: 'i' } }).select('_id');
        filter.booking = { $in: matchingBookings.map((b) => b._id) };
    }
    const { page, pageSize } = parsePagination(query);
    const [items, total] = await Promise.all([
        Payment_1.Payment.find(filter)
            .sort({ createdAt: -1 })
            .skip((page - 1) * pageSize)
            .limit(pageSize)
            .populate({
            path: 'booking',
            select: 'bookingCode customer',
            populate: { path: 'customer', select: 'name' },
        }),
        Payment_1.Payment.countDocuments(filter),
    ]);
    res.json({ items, total, page, pageSize });
}
//# sourceMappingURL=payments.controller.js.map