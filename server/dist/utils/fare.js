"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearFareCaches = clearFareCaches;
exports.findPricingRule = findPricingRule;
exports.computeFare = computeFare;
exports.computeCommission = computeCommission;
const PricingRule_1 = require("../models/PricingRule");
const CommissionRule_1 = require("../models/CommissionRule");
const cache_1 = require("./cache");
const http_1 = require("./http");
const ruleCache = new cache_1.TtlCache(10_000, 500);
const commissionCache = new cache_1.TtlCache(10_000, 100);
function clearFareCaches() {
    ruleCache.clear();
    commissionCache.clear();
}
const NIGHT_START_HOUR = 22;
const NIGHT_END_HOUR = 6;
/** The city-specific pricing rule for a category, falling back to the global (no service area) rule. */
function findPricingRule(categoryKey, serviceAreaId) {
    return ruleCache.get(`${categoryKey}:${serviceAreaId ?? 'global'}`, () => loadPricingRule(categoryKey, serviceAreaId));
}
async function loadPricingRule(categoryKey, serviceAreaId) {
    const base = { categoryKey, status: 'active', effectiveFrom: { $lte: new Date() } };
    if (serviceAreaId) {
        const local = await PricingRule_1.PricingRule.findOne({ ...base, serviceArea: serviceAreaId }).sort({ effectiveFrom: -1 });
        if (local)
            return local;
    }
    return PricingRule_1.PricingRule.findOne({ ...base, serviceArea: null }).sort({ effectiveFrom: -1 });
}
function isNight(at) {
    // Pricing follows Indian local time regardless of the server's timezone.
    // India has no daylight saving: local time is always UTC+5:30 (this avoids a slow Intl formatter on every fare).
    const hour = Math.floor(((at.getUTCHours() * 60 + at.getUTCMinutes() + 330) % 1440) / 60);
    return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}
function computeFare(rule, input) {
    const distance = rule.perKm * input.distanceKm;
    const time = (rule.perMinute ?? 0) * input.durationMin;
    const waiting = (rule.waitingChargePerMin ?? 0) * (input.waitingMin ?? 0);
    const multiplier = rule.nightChargeMultiplier ?? 1;
    const night = isNight(input.at ?? new Date()) && multiplier > 1 ? (rule.baseFare + distance + time) * (multiplier - 1) : 0;
    const extraStops = (rule.additionalStopCharge ?? 0) * (input.extraStops ?? 0);
    const loading = input.needsLoading ? rule.loadingUnloadingCharge ?? 0 : 0;
    let base = rule.baseFare;
    const rideFare = base + distance + time + waiting + night;
    // Bring short trips up to the minimum fare by raising the base component.
    if (rideFare < rule.minimumFare)
        base += rule.minimumFare - rideFare;
    const subtotal = base + distance + time + waiting + night + extraStops + loading;
    const platformFee = (rule.platformFeeFlat ?? 0) + (subtotal * (rule.platformFeePercent ?? 0)) / 100;
    const tax = ((subtotal + platformFee) * (rule.taxPercent ?? 0)) / 100;
    const gross = Math.round(subtotal + platformFee + tax);
    const discount = Math.min(gross, Math.round(input.discount ?? 0));
    return {
        base: (0, http_1.roundMoney)(base),
        distance: (0, http_1.roundMoney)(distance),
        time: (0, http_1.roundMoney)(time),
        waiting: (0, http_1.roundMoney)(waiting),
        night: (0, http_1.roundMoney)(night),
        extraStops: (0, http_1.roundMoney)(extraStops),
        loading: (0, http_1.roundMoney)(loading),
        platformFee: (0, http_1.roundMoney)(platformFee),
        tax: (0, http_1.roundMoney)(tax),
        discount,
        tip: 0,
        total: gross - discount,
    };
}
/** Platform commission on a completed trip, from the most specific active rule. */
async function computeCommission(categoryKey, fareTotal) {
    const rules = await commissionCache.get(categoryKey, () => CommissionRule_1.CommissionRule.find({
        appliesTo: 'driver',
        status: 'active',
        effectiveFrom: { $lte: new Date() },
        $or: [{ categoryKey }, { categoryKey: null }, { categoryKey: { $exists: false } }],
    }).sort({ effectiveFrom: -1 }));
    const rule = rules.find((r) => r.categoryKey === categoryKey) ?? rules[0];
    if (!rule)
        return 0;
    const commission = rule.type === 'percentage' ? (fareTotal * rule.value) / 100 : rule.value;
    return (0, http_1.roundMoney)(Math.min(fareTotal, Math.max(0, commission)));
}
//# sourceMappingURL=fare.js.map