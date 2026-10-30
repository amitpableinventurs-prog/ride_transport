"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTemplates = listTemplates;
exports.createTemplate = createTemplate;
exports.updateTemplate = updateTemplate;
exports.listBroadcasts = listBroadcasts;
exports.createBroadcast = createBroadcast;
const NotificationTemplate_1 = require("../models/NotificationTemplate");
const NotificationBroadcast_1 = require("../models/NotificationBroadcast");
const Customer_1 = require("../models/Customer");
const Device_1 = require("../models/Device");
const Driver_1 = require("../models/Driver");
const audit_1 = require("../utils/audit");
const notify_1 = require("../utils/notify");
const TEMPLATE_FIELDS = ['key', 'channel', 'title', 'body', 'status'];
function pickTemplateFields(body) {
    const out = {};
    for (const key of TEMPLATE_FIELDS) {
        if (body[key] !== undefined)
            out[key] = body[key];
    }
    return out;
}
async function listTemplates(_req, res) {
    const templates = await NotificationTemplate_1.NotificationTemplate.find().sort({ createdAt: -1 });
    res.json(templates);
}
async function createTemplate(req, res) {
    const body = req.body;
    if (!body.key || !body.channel || !body.body) {
        res.status(400).json({ message: 'key, channel and body are required' });
        return;
    }
    const template = await NotificationTemplate_1.NotificationTemplate.create(pickTemplateFields(body));
    await (0, audit_1.recordAudit)(req.admin, 'notification_template.create', 'NotificationTemplate', template.key);
    res.status(201).json(template);
}
async function updateTemplate(req, res) {
    const template = await NotificationTemplate_1.NotificationTemplate.findById(req.params.id);
    if (!template) {
        res.status(404).json({ message: 'Notification template not found' });
        return;
    }
    Object.assign(template, pickTemplateFields(req.body));
    await template.save();
    await (0, audit_1.recordAudit)(req.admin, 'notification_template.updated', 'NotificationTemplate', template.key);
    res.json(template);
}
const AUDIENCE_BASE_ESTIMATE = {
    all_customers: 8000,
    all_drivers: 1200,
    all_partners: 150,
    custom: 300,
};
// Push broadcasts that reach real devices; other audiences / channels are recorded with an estimate.
const PUSH_AUDIENCE_USER_TYPE = { all_customers: 'customer', all_drivers: 'driver' };
/** Device tokens a push broadcast goes to; null when the audience is not sent as push. */
async function broadcastTokens(audience, serviceModeFilter) {
    const userType = PUSH_AUDIENCE_USER_TYPE[audience];
    if (!userType)
        return null;
    const filter = { userType };
    // Riders can be limited to ride or delivery (transport) riders.
    if (userType === 'driver' && (serviceModeFilter === 'ride' || serviceModeFilter === 'transport')) {
        filter.userId = { $in: await Driver_1.Driver.find({ serviceType: serviceModeFilter === 'ride' ? 'rider' : 'transport' }).distinct('_id') };
    }
    // Customers can switch off offer notifications in Settings.
    if (userType === 'customer')
        filter.userId = { $nin: await Customer_1.Customer.find({ 'notificationPrefs.offers': false }).distinct('_id') };
    return { userType, tokens: await Device_1.Device.find(filter).distinct('token') };
}
async function listBroadcasts(_req, res) {
    const broadcasts = await NotificationBroadcast_1.NotificationBroadcast.find().populate('template', 'key channel').sort({ createdAt: -1 });
    res.json(broadcasts);
}
async function createBroadcast(req, res) {
    const body = req.body;
    if (!body.channel || !body.audience || !body.title || !body.body) {
        res.status(400).json({ message: 'channel, audience, title and body are required' });
        return;
    }
    const serviceModeFilter = body.serviceModeFilter ?? 'both';
    const push = body.channel === 'push' ? await broadcastTokens(body.audience, serviceModeFilter) : null;
    const base = AUDIENCE_BASE_ESTIMATE[body.audience] ?? 500;
    const recipientCountEstimate = push ? push.tokens.length : base + Math.floor(Math.random() * base * 0.5);
    const broadcast = await NotificationBroadcast_1.NotificationBroadcast.create({
        template: body.templateId || null,
        channel: body.channel,
        audience: body.audience,
        serviceModeFilter,
        title: body.title,
        body: body.body,
        sentBy: req.admin.id,
        recipientCountEstimate,
    });
    await (0, audit_1.recordAudit)(req.admin, 'notification.broadcast_sent', 'NotificationBroadcast', broadcast.title, {
        audience: broadcast.audience,
        channel: broadcast.channel,
        recipientCountEstimate,
    });
    // Sent after answering: a large audience takes a while, and the apps also show it in their notification list.
    if (push?.tokens.length) {
        const message = { title: broadcast.title, body: broadcast.body, data: { type: 'announcement', broadcastId: broadcast.id } };
        void (0, notify_1.pushToTokens)(push.userType, push.tokens, message).catch((err) => console.error('[broadcast] push failed', err));
    }
    const populated = await broadcast.populate('template', 'key channel');
    res.status(201).json(populated);
}
//# sourceMappingURL=notifications.controller.js.map