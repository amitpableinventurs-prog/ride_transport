"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adjustWalletBody = exports.updateCommissionBody = exports.createCommissionBody = exports.updatePricingBody = exports.createPricingBody = exports.updateAdminBody = exports.createAdminBody = exports.refreshBody = exports.adminResendOtpBody = exports.adminVerifyOtpBody = exports.adminLoginBody = exports.idParams = void 0;
// zod schemas for admin endpoints that move money, change permissions or sign people in.
// z.object() drops unknown fields, which is what stops a client from setting fields it should not.
const zod_1 = require("zod");
const rbac_1 = require("../types/rbac");
const text = (max) => zod_1.z.string().trim().min(1).max(max);
const money = (max = 1_000_000) => zod_1.z.number().finite().min(0).max(max);
const percent = zod_1.z.number().finite().min(0).max(100);
const status = zod_1.z.enum(['active', 'inactive']);
const date = zod_1.z.coerce.date();
const objectId = zod_1.z.string().regex(/^[a-f\d]{24}$/i, 'must be a valid id');
exports.idParams = zod_1.z.object({ id: objectId });
// ---------- Admin sign-in ----------
exports.adminLoginBody = zod_1.z.object({
    email: zod_1.z.string().trim().toLowerCase().email().max(254),
    password: zod_1.z.string().min(1).max(200),
});
exports.adminVerifyOtpBody = zod_1.z.object({ otpToken: zod_1.z.string().min(10).max(2000), otp: zod_1.z.string().regex(/^\d{6}$/, 'must be 6 digits') });
exports.adminResendOtpBody = zod_1.z.object({ otpToken: zod_1.z.string().min(10).max(2000) });
exports.refreshBody = zod_1.z.object({ refreshToken: zod_1.z.string().min(10).max(2000) });
// ---------- Admin users ----------
const phone = zod_1.z.string().trim().regex(/^\+?[\d\s-]{8,16}$/, 'must be a valid phone number');
exports.createAdminBody = zod_1.z.object({
    name: text(100),
    email: zod_1.z.string().trim().toLowerCase().email().max(254),
    phone,
    role: zod_1.z.enum(rbac_1.ROLE_KEYS),
});
exports.updateAdminBody = zod_1.z
    .object({ name: text(100), phone, role: zod_1.z.enum(rbac_1.ROLE_KEYS), status: zod_1.z.enum(['active', 'suspended']) })
    .partial();
// ---------- Pricing ----------
const pricingFields = {
    mode: zod_1.z.enum(['ride', 'transport']),
    categoryKey: text(60),
    serviceArea: objectId.nullable(),
    baseFare: money(),
    perKm: money(10_000),
    perMinute: money(10_000),
    minimumFare: money(),
    waitingChargePerMin: money(10_000),
    nightChargeMultiplier: zod_1.z.number().finite().min(1).max(5),
    platformFeeFlat: money(),
    platformFeePercent: percent,
    cancellationFee: money(),
    loadingUnloadingCharge: money(),
    additionalStopCharge: money(),
    taxPercent: percent,
    effectiveFrom: date,
    status,
};
exports.createPricingBody = zod_1.z.object(pricingFields).partial().required({ mode: true, categoryKey: true, baseFare: true, perKm: true, minimumFare: true });
exports.updatePricingBody = zod_1.z.object(pricingFields).partial();
// ---------- Commissions ----------
const commissionFields = {
    appliesTo: zod_1.z.enum(['driver', 'partner']),
    categoryKey: text(60).nullable(),
    type: zod_1.z.enum(['percentage', 'fixed']),
    value: money(),
    effectiveFrom: date,
    status,
};
const commissionRules = (v) => !(v.type === 'percentage' && v.value !== undefined && v.value > 100);
const commissionRuleMessage = { message: 'a percentage commission cannot be more than 100', path: ['value'] };
exports.createCommissionBody = zod_1.z
    .object(commissionFields)
    .partial()
    .required({ appliesTo: true, type: true, value: true })
    .refine(commissionRules, commissionRuleMessage);
exports.updateCommissionBody = zod_1.z.object(commissionFields).partial().refine(commissionRules, commissionRuleMessage);
// ---------- Wallets ----------
exports.adjustWalletBody = zod_1.z.object({
    type: zod_1.z.enum(['credit', 'debit']),
    amount: zod_1.z.number().finite().positive().max(100_000),
    reason: zod_1.z.string().max(40).optional(),
});
//# sourceMappingURL=schemas.js.map