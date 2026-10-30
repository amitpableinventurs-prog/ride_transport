"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCoupons = listCoupons;
exports.getCoupon = getCoupon;
exports.createCoupon = createCoupon;
exports.updateCoupon = updateCoupon;
exports.deleteCoupon = deleteCoupon;
const Coupon_1 = require("../models/Coupon");
const audit_1 = require("../utils/audit");
const regex_1 = require("../utils/regex");
const MUTABLE_FIELDS = [
    'code',
    'title',
    'autoApply',
    'discountType',
    'amount',
    'minBookingAmount',
    'maxDiscount',
    'validFrom',
    'validTo',
    'usageLimitTotal',
    'usageLimitPerUser',
    'applicableMode',
    'applicableCategories',
    'serviceAreas',
    'status',
];
function pickMutableFields(body) {
    const out = {};
    for (const key of MUTABLE_FIELDS) {
        if (body[key] !== undefined)
            out[key] = body[key];
    }
    // An empty string code should be stored as undefined so the sparse unique index doesn't collide.
    if (out.code === '')
        out.code = undefined;
    return out;
}
async function listCoupons(req, res) {
    const { autoApply, status, q } = req.query;
    const filter = {};
    if (autoApply === 'true')
        filter.autoApply = true;
    if (autoApply === 'false')
        filter.autoApply = false;
    if (status)
        filter.status = status;
    if (q) {
        filter.$or = [{ title: { $regex: (0, regex_1.searchRegex)(q), $options: 'i' } }, { code: { $regex: (0, regex_1.searchRegex)(q), $options: 'i' } }];
    }
    const coupons = await Coupon_1.Coupon.find(filter).sort({ createdAt: -1 });
    res.json(coupons);
}
async function getCoupon(req, res) {
    const coupon = await Coupon_1.Coupon.findById(req.params.id);
    if (!coupon) {
        res.status(404).json({ message: 'Coupon not found' });
        return;
    }
    res.json(coupon);
}
async function createCoupon(req, res) {
    const body = req.body;
    if (!body.title || !body.discountType || body.amount === undefined || !body.validFrom || !body.validTo) {
        res.status(400).json({ message: 'title, discountType, amount, validFrom and validTo are required' });
        return;
    }
    const coupon = await Coupon_1.Coupon.create(pickMutableFields(body));
    await (0, audit_1.recordAudit)(req.admin, coupon.autoApply ? 'offer.create' : 'coupon.create', coupon.autoApply ? 'Offer' : 'Coupon', coupon.title);
    res.status(201).json(coupon);
}
async function updateCoupon(req, res) {
    const coupon = await Coupon_1.Coupon.findById(req.params.id);
    if (!coupon) {
        res.status(404).json({ message: 'Coupon not found' });
        return;
    }
    const patch = pickMutableFields(req.body);
    Object.assign(coupon, patch);
    await coupon.save();
    await (0, audit_1.recordAudit)(req.admin, coupon.autoApply ? 'offer.updated' : 'coupon.updated', coupon.autoApply ? 'Offer' : 'Coupon', coupon.title, patch.status !== undefined ? { status: patch.status } : undefined);
    res.json(coupon);
}
async function deleteCoupon(req, res) {
    const coupon = await Coupon_1.Coupon.findById(req.params.id);
    if (!coupon) {
        res.status(404).json({ message: 'Coupon not found' });
        return;
    }
    await coupon.deleteOne();
    await (0, audit_1.recordAudit)(req.admin, coupon.autoApply ? 'offer.deleted' : 'coupon.deleted', coupon.autoApply ? 'Offer' : 'Coupon', coupon.title);
    res.status(204).end();
}
//# sourceMappingURL=coupons.controller.js.map