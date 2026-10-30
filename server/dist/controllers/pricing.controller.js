"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPricingRules = listPricingRules;
exports.createPricingRule = createPricingRule;
exports.updatePricingRule = updatePricingRule;
exports.deactivatePricingRule = deactivatePricingRule;
const PricingRule_1 = require("../models/PricingRule");
const audit_1 = require("../utils/audit");
async function listPricingRules(req, res) {
    const { mode, categoryKey, status } = req.query;
    const filter = {};
    if (mode)
        filter.mode = mode;
    if (categoryKey)
        filter.categoryKey = categoryKey;
    if (status)
        filter.status = status;
    const rules = await PricingRule_1.PricingRule.find(filter).sort({ mode: 1, categoryKey: 1, createdAt: -1 });
    res.json(rules);
}
async function createPricingRule(req, res) {
    const body = req.body;
    if (!body.mode || !body.categoryKey || body.baseFare === undefined || body.perKm === undefined || body.minimumFare === undefined) {
        res.status(400).json({ message: 'mode, categoryKey, baseFare, perKm and minimumFare are required' });
        return;
    }
    const rule = await PricingRule_1.PricingRule.create(req.body);
    await (0, audit_1.recordAudit)(req.admin, 'pricing_rule.created', 'PricingRule', `${rule.mode}:${rule.categoryKey}`);
    res.status(201).json(rule);
}
async function updatePricingRule(req, res) {
    const rule = await PricingRule_1.PricingRule.findById(req.params.id);
    if (!rule) {
        res.status(404).json({ message: 'Pricing rule not found' });
        return;
    }
    const body = req.body;
    const allowedKeys = [
        'mode',
        'categoryKey',
        'serviceArea',
        'baseFare',
        'perKm',
        'perMinute',
        'minimumFare',
        'waitingChargePerMin',
        'nightChargeMultiplier',
        'platformFeeFlat',
        'platformFeePercent',
        'cancellationFee',
        'loadingUnloadingCharge',
        'additionalStopCharge',
        'taxPercent',
        'effectiveFrom',
        'status',
    ];
    const mutableRule = rule;
    for (const key of allowedKeys) {
        if (body[key] !== undefined)
            mutableRule[key] = body[key];
    }
    await rule.save();
    await (0, audit_1.recordAudit)(req.admin, 'pricing_rule.updated', 'PricingRule', `${rule.mode}:${rule.categoryKey}`, body);
    res.json(rule);
}
async function deactivatePricingRule(req, res) {
    const rule = await PricingRule_1.PricingRule.findById(req.params.id);
    if (!rule) {
        res.status(404).json({ message: 'Pricing rule not found' });
        return;
    }
    rule.status = 'inactive';
    await rule.save();
    await (0, audit_1.recordAudit)(req.admin, 'pricing_rule.deactivated', 'PricingRule', `${rule.mode}:${rule.categoryKey}`);
    res.json(rule);
}
//# sourceMappingURL=pricing.controller.js.map