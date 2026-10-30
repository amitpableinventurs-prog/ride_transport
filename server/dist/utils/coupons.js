"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyCoupon = applyCoupon;
const Coupon_1 = require("../models/Coupon");
const Booking_1 = require("../models/Booking");
const http_1 = require("./http");
/** Validates a coupon for a fare; throws 400 with the reason when it cannot be used. */
async function applyCoupon(input) {
    const code = input.code.trim().toUpperCase();
    const now = new Date();
    const coupon = await Coupon_1.Coupon.findOne({ code, status: 'active' });
    if (!coupon || coupon.validFrom > now || coupon.validTo < now)
        throw new http_1.HttpError(400, 'This coupon is invalid or has expired');
    if (coupon.applicableMode !== 'both' && coupon.applicableMode !== input.mode) {
        throw new http_1.HttpError(400, `This coupon is only valid on ${coupon.applicableMode} bookings`);
    }
    if (coupon.applicableCategories.length && !coupon.applicableCategories.includes(input.categoryKey)) {
        throw new http_1.HttpError(400, 'This coupon is not valid for the selected vehicle');
    }
    if (coupon.serviceAreas.length && !coupon.serviceAreas.some((id) => input.serviceAreaId && id.equals(input.serviceAreaId))) {
        throw new http_1.HttpError(400, 'This coupon is not valid in your city');
    }
    if (input.fareTotal < (coupon.minBookingAmount ?? 0)) {
        throw new http_1.HttpError(400, `Minimum booking amount for this coupon is ₹${coupon.minBookingAmount}`);
    }
    if (coupon.usageLimitTotal != null && coupon.usedCount >= coupon.usageLimitTotal) {
        throw new http_1.HttpError(400, 'This coupon has reached its usage limit');
    }
    if (coupon.usageLimitPerUser != null) {
        const used = await Booking_1.Booking.countDocuments({ customer: input.customerId, couponCode: code, status: { $ne: 'cancelled' } });
        if (used >= coupon.usageLimitPerUser)
            throw new http_1.HttpError(400, 'You have already used this coupon');
    }
    let discount = coupon.discountType === 'flat' ? coupon.amount : (input.fareTotal * coupon.amount) / 100;
    if (coupon.maxDiscount != null)
        discount = Math.min(discount, coupon.maxDiscount);
    discount = Math.round(Math.min(discount, input.fareTotal));
    return { coupon, code, discount: (0, http_1.roundMoney)(discount) };
}
//# sourceMappingURL=coupons.js.map