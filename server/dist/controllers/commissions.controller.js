"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listCommissionRules = listCommissionRules;
exports.createCommissionRule = createCommissionRule;
exports.updateCommissionRule = updateCommissionRule;
exports.deactivateCommissionRule = deactivateCommissionRule;
const CommissionRule_1 = require("../models/CommissionRule");
const audit_1 = require("../utils/audit");
async function listCommissionRules(req, res) {
    const { appliesTo, categoryKey, status } = req.query;
    const filter = {};
    if (appliesTo)
        filter.appliesTo = appliesTo;
    if (categoryKey)
        filter.categoryKey = categoryKey;
    if (status)
        filter.status = status;
    const rules = await CommissionRule_1.CommissionRule.find(filter).sort({ appliesTo: 1, createdAt: -1 });
    res.json(rules);
}
async function createCommissionRule(req, res) {
    const body = req.body;
    if (!body.appliesTo || !body.type || body.value === undefined) {
        res.status(400).json({ message: 'appliesTo, type and value are required' });
        return;
    }
    const rule = await CommissionRule_1.CommissionRule.create(req.body);
    const label = `${rule.appliesTo}${rule.categoryKey ? `:${rule.categoryKey}` : ''}`;
    await (0, audit_1.recordAudit)(req.admin, 'commission_rule.created', 'CommissionRule', label);
    res.status(201).json(rule);
}
async function updateCommissionRule(req, res) {
    const rule = await CommissionRule_1.CommissionRule.findById(req.params.id);
    if (!rule) {
        res.status(404).json({ message: 'Commission rule not found' });
        return;
    }
    const body = req.body;
    const allowedKeys = ['appliesTo', 'categoryKey', 'type', 'value', 'effectiveFrom', 'status'];
    const mutableRule = rule;
    for (const key of allowedKeys) {
        if (body[key] !== undefined)
            mutableRule[key] = body[key];
    }
    await rule.save();
    const label = `${rule.appliesTo}${rule.categoryKey ? `:${rule.categoryKey}` : ''}`;
    await (0, audit_1.recordAudit)(req.admin, 'commission_rule.updated', 'CommissionRule', label, body);
    res.json(rule);
}
async function deactivateCommissionRule(req, res) {
    const rule = await CommissionRule_1.CommissionRule.findById(req.params.id);
    if (!rule) {
        res.status(404).json({ message: 'Commission rule not found' });
        return;
    }
    rule.status = 'inactive';
    await rule.save();
    const label = `${rule.appliesTo}${rule.categoryKey ? `:${rule.categoryKey}` : ''}`;
    await (0, audit_1.recordAudit)(req.admin, 'commission_rule.deactivated', 'CommissionRule', label);
    res.json(rule);
}
//# sourceMappingURL=commissions.controller.js.map