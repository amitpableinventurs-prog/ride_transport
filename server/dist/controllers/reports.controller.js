"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBookingReport = getBookingReport;
exports.getRevenueReport = getRevenueReport;
exports.getRiderReport = getRiderReport;
exports.getPartnerReport = getPartnerReport;
exports.getFinancialReport = getFinancialReport;
const Booking_1 = require("../models/Booking");
const Payment_1 = require("../models/Payment");
const Refund_1 = require("../models/Refund");
const Driver_1 = require("../models/Driver");
const TransportPartner_1 = require("../models/TransportPartner");
const WalletTransaction_1 = require("../models/WalletTransaction");
const MS_PER_DAY = 24 * 60 * 60 * 1000;
// All 5 report endpoints share the same ?from=&to= contract (ISO dates,
// defaulting to the last 30 days, filtering by createdAt). Date-only strings
// (no "T") are treated as inclusive of the whole day on the `to` side so a
// plain <input type="date"> range behaves the way an admin would expect.
function resolveRange(req) {
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * MS_PER_DAY);
    const fromRaw = typeof req.query.from === 'string' ? req.query.from : undefined;
    const toRaw = typeof req.query.to === 'string' ? req.query.to : undefined;
    const fromParsed = fromRaw ? new Date(fromRaw) : null;
    let toParsed = toRaw ? new Date(toRaw) : null;
    if (toParsed && !Number.isNaN(toParsed.getTime()) && toRaw && !toRaw.includes('T')) {
        toParsed = new Date(toParsed.getTime() + MS_PER_DAY - 1);
    }
    const from = fromParsed && !Number.isNaN(fromParsed.getTime()) ? fromParsed : defaultFrom;
    const to = toParsed && !Number.isNaN(toParsed.getTime()) ? toParsed : now;
    return { from, to };
}
// GET /reports/booking?from=&to=&mode=&status=
async function getBookingReport(req, res) {
    const { from, to } = resolveRange(req);
    const mode = typeof req.query.mode === 'string' ? req.query.mode : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const match = { createdAt: { $gte: from, $lte: to } };
    if (mode)
        match.mode = mode;
    if (status)
        match.status = status;
    const [bookingDocs, summaryAgg] = await Promise.all([
        Booking_1.Booking.find(match)
            .sort({ createdAt: -1 })
            .limit(1000)
            .select('bookingCode mode categoryKey status fare createdAt customer driver')
            .populate('customer', 'name')
            .populate('driver', 'name')
            .lean(),
        Booking_1.Booking.aggregate([
            { $match: match },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
                    cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
                    totalFare: { $sum: '$fare.total' },
                },
            },
        ]),
    ]);
    const rows = bookingDocs.map((b) => ({
        bookingCode: b.bookingCode,
        mode: b.mode,
        categoryKey: b.categoryKey,
        customerName: b.customer?.name ?? 'Unknown',
        driverName: b.driver?.name ?? 'Unassigned',
        status: b.status,
        fareTotal: b.fare?.total ?? 0,
        createdAt: b.createdAt,
    }));
    const summaryDoc = summaryAgg[0];
    res.json({
        summary: {
            total: summaryDoc?.total ?? 0,
            completed: summaryDoc?.completed ?? 0,
            cancelled: summaryDoc?.cancelled ?? 0,
            totalFare: summaryDoc?.totalFare ?? 0,
        },
        rows,
    });
}
// GET /reports/revenue?from=&to=
async function getRevenueReport(req, res) {
    const { from, to } = resolveRange(req);
    const dateRangeMatch = { createdAt: { $gte: from, $lte: to } };
    const [revenueAgg, byDayAgg, refundAgg] = await Promise.all([
        Booking_1.Booking.aggregate([
            { $match: { ...dateRangeMatch, status: 'completed' } },
            {
                $group: {
                    _id: null,
                    grossRevenue: { $sum: '$fare.total' },
                    platformCommission: { $sum: '$fare.platformFee' },
                },
            },
        ]),
        Booking_1.Booking.aggregate([
            { $match: { ...dateRangeMatch, status: 'completed' } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    revenue: { $sum: '$fare.total' },
                },
            },
            { $sort: { _id: 1 } },
        ]),
        Refund_1.Refund.aggregate([
            { $match: { ...dateRangeMatch, status: 'processed' } },
            { $group: { _id: null, refunds: { $sum: '$amount' } } },
        ]),
    ]);
    const revenueDoc = revenueAgg[0];
    const refundDoc = refundAgg[0];
    const grossRevenue = revenueDoc?.grossRevenue ?? 0;
    const platformCommission = revenueDoc?.platformCommission ?? 0;
    const refunds = refundDoc?.refunds ?? 0;
    const byDay = byDayAgg.map((d) => ({
        date: d._id,
        revenue: d.revenue ?? 0,
    }));
    res.json({
        summary: {
            grossRevenue,
            platformCommission,
            refunds,
            netRevenue: grossRevenue - refunds,
        },
        byDay,
    });
}
// GET /reports/rider?from=&to=
async function getRiderReport(req, res) {
    const { from, to } = resolveRange(req);
    const [drivers, bookingAgg] = await Promise.all([
        Driver_1.Driver.find().select('name serviceType totalTrips earnings rating').limit(1000).lean(),
        Booking_1.Booking.aggregate([
            { $match: { driver: { $ne: null }, createdAt: { $gte: from, $lte: to } } },
            { $group: { _id: { driver: '$driver', status: '$status' }, count: { $sum: 1 } } },
        ]),
    ]);
    const statsByDriver = new Map();
    for (const entry of bookingAgg) {
        const key = String(entry._id.driver);
        const current = statsByDriver.get(key) ?? { completed: 0, cancelled: 0 };
        if (entry._id.status === 'completed')
            current.completed += entry.count;
        if (entry._id.status === 'cancelled')
            current.cancelled += entry.count;
        statsByDriver.set(key, current);
    }
    const rows = drivers.map((d) => {
        const stats = statsByDriver.get(String(d._id)) ?? { completed: 0, cancelled: 0 };
        return {
            driverName: d.name,
            serviceType: d.serviceType,
            totalTrips: d.totalTrips ?? 0,
            completedInRange: stats.completed,
            cancelledInRange: stats.cancelled,
            earnings: d.earnings ?? 0,
            rating: d.rating ?? 0,
        };
    });
    res.json({ rows });
}
// GET /reports/partner?from=&to=
async function getPartnerReport(req, res) {
    const { from, to } = resolveRange(req);
    const [partners, bookingAgg] = await Promise.all([
        TransportPartner_1.TransportPartner.find().select('companyName vehicleCount driverCount status').limit(1000).lean(),
        Booking_1.Booking.aggregate([
            { $match: { partner: { $ne: null }, mode: 'transport', createdAt: { $gte: from, $lte: to } } },
            { $group: { _id: '$partner', deliveries: { $sum: 1 }, revenue: { $sum: '$fare.total' } } },
        ]),
    ]);
    const statsByPartner = new Map();
    for (const entry of bookingAgg) {
        statsByPartner.set(String(entry._id), { deliveries: entry.deliveries, revenue: entry.revenue ?? 0 });
    }
    const rows = partners.map((p) => {
        const stats = statsByPartner.get(String(p._id)) ?? { deliveries: 0, revenue: 0 };
        return {
            companyName: p.companyName,
            vehicleCount: p.vehicleCount ?? 0,
            driverCount: p.driverCount ?? 0,
            deliveriesInRange: stats.deliveries,
            revenueInRange: stats.revenue,
            status: p.status,
        };
    });
    res.json({ rows });
}
// GET /reports/financial?from=&to=
async function getFinancialReport(req, res) {
    const { from, to } = resolveRange(req);
    const dateRangeMatch = { createdAt: { $gte: from, $lte: to } };
    const [paymentTotalAgg, refundTotalAgg, walletAgg, paymentByDayAgg, refundByDayAgg] = await Promise.all([
        Payment_1.Payment.aggregate([
            { $match: { ...dateRangeMatch, status: 'success' } },
            { $group: { _id: null, amount: { $sum: '$amount' } } },
        ]),
        Refund_1.Refund.aggregate([
            { $match: { ...dateRangeMatch, status: 'processed' } },
            { $group: { _id: null, amount: { $sum: '$amount' } } },
        ]),
        WalletTransaction_1.WalletTransaction.aggregate([
            { $match: dateRangeMatch },
            { $group: { _id: '$type', amount: { $sum: '$amount' } } },
        ]),
        Payment_1.Payment.aggregate([
            { $match: { ...dateRangeMatch, status: 'success' } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                    amount: { $sum: '$amount' },
                },
            },
        ]),
        Refund_1.Refund.aggregate([
            { $match: { ...dateRangeMatch, status: 'processed' } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
                    count: { $sum: 1 },
                    amount: { $sum: '$amount' },
                },
            },
        ]),
    ]);
    const grossRevenue = paymentTotalAgg[0]?.amount ?? 0;
    const refunds = refundTotalAgg[0]?.amount ?? 0;
    let walletCreditsTotal = 0;
    let walletDebitsTotal = 0;
    for (const entry of walletAgg) {
        if (entry._id === 'credit')
            walletCreditsTotal = entry.amount ?? 0;
        if (entry._id === 'debit')
            walletDebitsTotal = entry.amount ?? 0;
    }
    const byDate = new Map();
    for (const entry of paymentByDayAgg) {
        const row = byDate.get(entry._id) ?? { paymentsCount: 0, paymentsAmount: 0, refundsCount: 0, refundsAmount: 0 };
        row.paymentsCount = entry.count;
        row.paymentsAmount = entry.amount ?? 0;
        byDate.set(entry._id, row);
    }
    for (const entry of refundByDayAgg) {
        const row = byDate.get(entry._id) ?? { paymentsCount: 0, paymentsAmount: 0, refundsCount: 0, refundsAmount: 0 };
        row.refundsCount = entry.count;
        row.refundsAmount = entry.amount ?? 0;
        byDate.set(entry._id, row);
    }
    const rows = Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, r]) => ({ date, ...r }));
    res.json({
        summary: {
            grossRevenue,
            refunds,
            netRevenue: grossRevenue - refunds,
            walletCreditsTotal,
            walletDebitsTotal,
        },
        rows,
    });
}
//# sourceMappingURL=reports.controller.js.map