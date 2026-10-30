"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listBanners = listBanners;
exports.getBanner = getBanner;
exports.createBanner = createBanner;
exports.updateBanner = updateBanner;
exports.deleteBanner = deleteBanner;
const Banner_1 = require("../models/Banner");
const audit_1 = require("../utils/audit");
const MUTABLE_FIELDS = ['title', 'description', 'imageUrl', 'ctaLabel', 'targetLink', 'serviceMode', 'startDate', 'endDate', 'status'];
function pickMutableFields(body) {
    const out = {};
    for (const key of MUTABLE_FIELDS) {
        if (body[key] !== undefined)
            out[key] = body[key];
    }
    return out;
}
async function listBanners(req, res) {
    const { status, serviceMode } = req.query;
    const filter = {};
    if (status)
        filter.status = status;
    if (serviceMode)
        filter.serviceMode = serviceMode;
    const banners = await Banner_1.Banner.find(filter).sort({ createdAt: -1 });
    res.json(banners);
}
async function getBanner(req, res) {
    const banner = await Banner_1.Banner.findById(req.params.id);
    if (!banner) {
        res.status(404).json({ message: 'Banner not found' });
        return;
    }
    res.json(banner);
}
async function createBanner(req, res) {
    const body = req.body;
    if (!body.title || !body.imageUrl || !body.startDate || !body.endDate) {
        res.status(400).json({ message: 'title, imageUrl, startDate and endDate are required' });
        return;
    }
    const banner = await Banner_1.Banner.create(pickMutableFields(body));
    await (0, audit_1.recordAudit)(req.admin, 'banner.create', 'Banner', banner.title);
    res.status(201).json(banner);
}
async function updateBanner(req, res) {
    const banner = await Banner_1.Banner.findById(req.params.id);
    if (!banner) {
        res.status(404).json({ message: 'Banner not found' });
        return;
    }
    const patch = pickMutableFields(req.body);
    Object.assign(banner, patch);
    await banner.save();
    await (0, audit_1.recordAudit)(req.admin, 'banner.updated', 'Banner', banner.title, patch.status !== undefined ? { status: patch.status } : undefined);
    res.json(banner);
}
async function deleteBanner(req, res) {
    const banner = await Banner_1.Banner.findById(req.params.id);
    if (!banner) {
        res.status(404).json({ message: 'Banner not found' });
        return;
    }
    await banner.deleteOne();
    await (0, audit_1.recordAudit)(req.admin, 'banner.deleted', 'Banner', banner.title);
    res.status(204).end();
}
//# sourceMappingURL=banners.controller.js.map