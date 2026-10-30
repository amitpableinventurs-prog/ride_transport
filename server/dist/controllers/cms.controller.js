"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CMS_SLUGS = void 0;
exports.listCmsPages = listCmsPages;
exports.getCmsPage = getCmsPage;
exports.updateCmsPage = updateCmsPage;
const CmsPage_1 = require("../models/CmsPage");
const audit_1 = require("../utils/audit");
exports.CMS_SLUGS = ['about', 'contact', 'terms', 'privacy', 'cancellation', 'refund', 'rider_terms', 'rider_privacy', 'partner_terms', 'faq'];
const CMS_TITLES = {
    about: 'About Us',
    contact: 'Contact Us',
    terms: 'Terms & Conditions',
    privacy: 'Privacy Policy',
    cancellation: 'Cancellation Policy',
    refund: 'Refund Policy',
    rider_terms: 'Rider Terms & Conditions',
    rider_privacy: 'Privacy Policy',
    partner_terms: 'Partner Terms',
    faq: 'FAQ',
};
function isCmsSlug(value) {
    return exports.CMS_SLUGS.includes(value);
}
async function getOrCreatePage(slug) {
    const existing = await CmsPage_1.CmsPage.findOne({ slug });
    if (existing)
        return existing;
    return CmsPage_1.CmsPage.create({ slug, title: CMS_TITLES[slug], content: '' });
}
async function listCmsPages(_req, res) {
    const pages = await Promise.all(exports.CMS_SLUGS.map((slug) => getOrCreatePage(slug)));
    res.json(pages);
}
async function getCmsPage(req, res) {
    const { slug } = req.params;
    if (!isCmsSlug(slug)) {
        res.status(404).json({ message: 'Unknown CMS page' });
        return;
    }
    const page = await getOrCreatePage(slug);
    res.json(page);
}
async function updateCmsPage(req, res) {
    const { slug } = req.params;
    if (!isCmsSlug(slug)) {
        res.status(404).json({ message: 'Unknown CMS page' });
        return;
    }
    const body = req.body;
    const page = await getOrCreatePage(slug);
    if (body.title !== undefined)
        page.title = body.title;
    if (body.content !== undefined)
        page.content = body.content;
    page.updatedBy = req.admin.id;
    await page.save();
    await (0, audit_1.recordAudit)(req.admin, 'cms.updated', 'CmsPage', page.title);
    res.json(page);
}
//# sourceMappingURL=cms.controller.js.map