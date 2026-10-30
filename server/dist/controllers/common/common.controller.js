"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGAL_PAGE_PATHS = void 0;
exports.getAppConfig = getAppConfig;
exports.getCmsPage = getCmsPage;
exports.appLegalPage = appLegalPage;
exports.legalPage = legalPage;
exports.registerDevice = registerDevice;
exports.publicTrack = publicTrack;
exports.publicInvoice = publicInvoice;
const pdfkit_1 = __importDefault(require("pdfkit"));
const Booking_1 = require("../../models/Booking");
const CmsPage_1 = require("../../models/CmsPage");
const Customer_1 = require("../../models/Customer");
const Device_1 = require("../../models/Device");
const Driver_1 = require("../../models/Driver");
const ServiceCategory_1 = require("../../models/ServiceCategory");
const Vehicle_1 = require("../../models/Vehicle");
const env_1 = require("../../config/env");
const profile_controller_1 = require("../app/profile.controller");
const http_1 = require("../../utils/http");
const jwt_1 = require("../../utils/jwt");
const settings_1 = require("../../utils/settings");
const geo_1 = require("../../utils/geo");
/** A shared tracking link keeps working this long after the trip ends. */
const SHARE_GRACE_MS = 60 * 60 * 1000;
// GET /common/app-config?app=customer|rider
async function getAppConfig(req, res) {
    const app = req.query.app === 'rider' ? 'rider' : 'customer';
    const s = await (0, settings_1.getPlatformSettings)();
    res.json({
        app,
        platformName: s.platformName,
        minVersion: app === 'rider' ? s.riderAppMinVersion : s.customerAppMinVersion,
        maintenanceMode: s.maintenanceMode,
        features: { ride: s.rideServiceEnabled, transport: s.transportServiceEnabled },
        support: { phone: s.supportPhone, email: s.supportEmail },
        currency: s.defaultCurrency,
        riderRequestTimeoutSeconds: s.riderRequestTimeoutSeconds,
        // Language Settings screen; save the choice with PATCH /profile { language }.
        languages: profile_controller_1.APP_LANGUAGES.map((code) => ({ code, name: LANGUAGE_NAMES[code] })),
    });
}
// GET /common/cms/:slug
async function getCmsPage(req, res) {
    const page = await CmsPage_1.CmsPage.findOne({ slug: req.params.slug }).select('slug title content updatedAt');
    if (!page)
        throw new http_1.HttpError(404, 'Page not found');
    res.json(page);
}
const LANGUAGE_NAMES = {
    en: 'English',
    hi: 'हिन्दी',
    mr: 'मराठी',
    gu: 'ગુજરાતી',
    bn: 'বাংলা',
    ta: 'தமிழ்',
    te: 'తెలుగు',
    kn: 'ಕನ್ನಡ',
    ml: 'മലയാളം',
    pa: 'ਪੰਜਾਬੀ',
    or: 'ଓଡ଼ିଆ',
};
/** Public web addresses of the legal pages (Play Store / App Store listings link to these) and their CMS slugs. */
exports.LEGAL_PAGE_PATHS = { '/terms': 'terms', '/privacy': 'privacy', '/rider-terms': 'rider_terms', '/rider-privacy': 'rider_privacy' };
/** CMS slug of each app's terms and privacy policy. */
const APP_LEGAL_SLUGS = {
    customer: { terms: 'terms', privacy: 'privacy' },
    rider: { terms: 'rider_terms', privacy: 'rider_privacy' },
};
const WEB_PATH_FOR_SLUG = Object.fromEntries(Object.entries(exports.LEGAL_PAGE_PATHS).map(([webPath, slug]) => [slug, webPath]));
// GET /customer/terms, /customer/privacy-policy, /rider/terms, /rider/privacy-policy: no login,
// so the apps can show them on the sign-up screen. `url` is the same page as a web page.
function appLegalPage(app, page) {
    const slug = APP_LEGAL_SLUGS[app][page];
    return async (_req, res) => {
        const doc = await CmsPage_1.CmsPage.findOne({ slug }).select('title content updatedAt');
        if (!doc || !doc.content.trim())
            throw new http_1.HttpError(404, 'This page has not been published yet');
        res.json({ app, page, slug, title: doc.title, content: doc.content, updatedAt: doc.updatedAt, url: `${env_1.env.publicBaseUrl}${WEB_PATH_FOR_SLUG[slug]}` });
    };
}
function escapeHtml(text) {
    return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function legalPageHtml(opts) {
    const title = escapeHtml(opts.title);
    const platformName = escapeHtml(opts.platformName);
    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · ${platformName}</title>
<style>
  :root { color-scheme: light dark; --bg: #ffffff; --text: #1f2328; --muted: #656d76; --rule: #d8dee4; }
  @media (prefers-color-scheme: dark) { :root { --bg: #0d1117; --text: #e6edf3; --muted: #8d96a0; --rule: #30363d; } }
  body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.65 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 16px 48px; }
  .brand { color: var(--muted); font-size: 14px; font-weight: 600; letter-spacing: .02em; }
  h1 { font-size: 28px; line-height: 1.25; margin: 6px 0 4px; }
  .updated { color: var(--muted); font-size: 14px; margin: 0 0 24px; }
  p { margin: 0 0 16px; white-space: pre-line; overflow-wrap: anywhere; }
  h2 { font-size: 19px; line-height: 1.35; margin: 28px 0 10px; }
  ul { margin: 0 0 16px; padding-left: 22px; }
  li { margin: 0 0 6px; overflow-wrap: anywhere; }
  footer { border-top: 1px solid var(--rule); margin-top: 32px; padding-top: 16px; color: var(--muted); font-size: 14px; }
</style>
</head>
<body>
<main>
<div class="brand">${platformName}</div>
<h1>${title}</h1>
${opts.body}
<footer>${opts.footer}</footer>
</main>
</body>
</html>`;
}
// GET /terms, /privacy, /rider-terms: the CMS page as a web page (no login), for store listings and in-app web views.
async function legalPage(req, res) {
    const slug = exports.LEGAL_PAGE_PATHS[req.path];
    const [page, settings] = await Promise.all([CmsPage_1.CmsPage.findOne({ slug }).select('title content updatedAt'), (0, settings_1.getPlatformSettings)()]);
    const content = page?.content.trim();
    const footer = `Questions? Contact ${escapeHtml(settings.supportEmail)} · ${escapeHtml(settings.supportPhone)}`;
    res.type('html').setHeader('Cache-Control', 'public, max-age=300');
    if (!page || !content) {
        res.status(404).send(legalPageHtml({ title: 'Page not available', platformName: settings.platformName, body: '<p>This page has not been published yet.</p>', footer }));
        return;
    }
    // Content is plain text from the admin panel: blank lines separate blocks, a lone "N. Title" line
    // is a section heading and a block of "• " lines is a list.
    const paragraphs = content
        .split(/\n\s*\n/)
        .map((raw) => {
        const block = raw.trim();
        const lines = block.split('\n').map((l) => l.trim());
        if (lines.length === 1 && /^\d+\.\s+\S.{0,90}$/.test(block))
            return `<h2>${escapeHtml(block)}</h2>`;
        if (lines.every((l) => /^[•-]\s+/.test(l)))
            return `<ul>${lines.map((l) => `<li>${escapeHtml(l.replace(/^[•-]\s+/, ''))}</li>`).join('')}</ul>`;
        return `<p>${escapeHtml(block)}</p>`;
    })
        .join('\n');
    const updated = page.updatedAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });
    res.send(legalPageHtml({
        title: page.title,
        platformName: settings.platformName,
        body: `<p class="updated">Last updated ${escapeHtml(updated)}</p>\n${paragraphs}`,
        footer,
    }));
}
// POST /common/devices: register (or move) an FCM token to the logged-in user.
async function registerDevice(req, res) {
    const user = req.appUser;
    const body = req.body;
    const token = (0, http_1.requireString)(body.token, 'token', 4096);
    const platform = body.platform ?? 'android';
    if (!['android', 'ios', 'web'].includes(platform))
        throw new http_1.HttpError(400, 'platform must be android, ios or web');
    const device = await Device_1.Device.findOneAndUpdate({ token }, { token, userType: user.type, userId: user.doc._id, platform, appVersion: (0, http_1.optionalString)(body.appVersion, 20), lastSeenAt: new Date() }, { upsert: true, new: true, setDefaultsOnInsert: true });
    res.status(201).json({ id: device.id, platform: device.platform });
}
// GET /public/track/:token: data for the shared live-tracking page (no login).
async function publicTrack(req, res) {
    const booking = await Booking_1.Booking.findOne({ shareToken: req.params.token });
    const ended = booking && !Booking_1.OPEN_BOOKING_STATUSES.includes(booking.status);
    const endedAt = booking?.completedAt ?? booking?.updatedAt;
    if (!booking || (ended && endedAt && Date.now() - endedAt.getTime() > SHARE_GRACE_MS))
        throw new http_1.HttpError(404, 'This tracking link has expired');
    const [driver, vehicle, customer] = await Promise.all([
        booking.driver ? Driver_1.Driver.findById(booking.driver).select('name rating currentLocation') : null,
        booking.vehicle ? Vehicle_1.Vehicle.findById(booking.vehicle).select('registrationNumber model') : null,
        Customer_1.Customer.findById(booking.customer).select('name'),
    ]);
    const loc = !ended && driver?.currentLocation?.lat != null ? driver.currentLocation : null;
    const beforePickup = ['accepted', 'arriving', 'arrived'].includes(booking.status);
    const target = beforePickup ? booking.pickup : booking.drop;
    res.json({
        bookingCode: booking.bookingCode,
        status: booking.status,
        mode: booking.mode,
        // First names only on the public page.
        customerName: customer?.name?.split(' ')[0] ?? null,
        pickup: { address: booking.pickup?.address, lat: booking.pickup?.lat, lng: booking.pickup?.lng },
        drop: { address: booking.drop?.address, lat: booking.drop?.lat, lng: booking.drop?.lng },
        rider: driver ? { name: driver.name.split(' ')[0], rating: driver.rating } : null,
        vehicle: vehicle ? { registrationNumber: vehicle.registrationNumber, model: vehicle.model } : null,
        location: loc ? { lat: loc.lat, lng: loc.lng, heading: loc.heading, updatedAt: loc.updatedAt } : null,
        etaMin: loc && target?.lat != null ? (0, geo_1.etaMinutes)({ lat: loc.lat, lng: loc.lng }, { lat: target.lat, lng: target.lng }) : null,
    });
}
// GET /public/invoices/:token: invoice PDF for a completed booking.
async function publicInvoice(req, res) {
    const bookingId = (0, jwt_1.verifyInvoiceToken)(String(req.params.token));
    const booking = bookingId ? await Booking_1.Booking.findOne({ _id: bookingId, status: 'completed' }) : null;
    if (!booking)
        throw new http_1.HttpError(404, 'This invoice link is invalid or has expired');
    const [settings, customer, driver, vehicle, category] = await Promise.all([
        (0, settings_1.getPlatformSettings)(),
        Customer_1.Customer.findById(booking.customer).select('name phone email'),
        booking.driver ? Driver_1.Driver.findById(booking.driver).select('name') : null,
        booking.vehicle ? Vehicle_1.Vehicle.findById(booking.vehicle).select('registrationNumber') : null,
        ServiceCategory_1.ServiceCategory.findOne({ key: booking.categoryKey }).select('name'),
    ]);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="invoice-${booking.bookingCode}.pdf"`);
    const pdf = new pdfkit_1.default({ size: 'A4', margin: 50 });
    pdf.pipe(res);
    const money = (n) => `INR ${(n ?? 0).toFixed(2)}`;
    const date = (d) => (d ? d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-');
    pdf.fontSize(20).text(settings.platformName, { continued: false });
    pdf.fontSize(10).fillColor('#555').text(`${settings.supportEmail} · ${settings.supportPhone}`);
    pdf.moveDown().fillColor('#000').fontSize(14).text('Trip invoice');
    pdf.fontSize(10);
    pdf.text(`Invoice no: INV-${booking.bookingCode}`);
    pdf.text(`Booking: ${booking.bookingCode} (${booking.mode === 'ride' ? 'Ride' : 'Transport'} · ${category?.name ?? booking.categoryKey})`);
    pdf.text(`Trip date: ${date(booking.startedAt ?? booking.createdAt)} — ${date(booking.completedAt)}`);
    pdf.moveDown();
    pdf.text(`Customer: ${customer?.name || '-'} (${customer?.phone ?? ''})`);
    pdf.text(`Rider: ${driver?.name || '-'}${vehicle ? ` · ${vehicle.registrationNumber}` : ''}`);
    pdf.moveDown();
    pdf.text(`From: ${booking.pickup?.address ?? `${booking.pickup?.lat}, ${booking.pickup?.lng}`}`);
    if (booking.mode === 'transport')
        booking.stops.forEach((s, i) => pdf.text(`Drop ${i + 1}: ${s.address ?? `${s.lat}, ${s.lng}`}`));
    else
        pdf.text(`To: ${booking.drop?.address ?? `${booking.drop?.lat}, ${booking.drop?.lng}`}`);
    pdf.text(`Distance: ${booking.distanceKm} km`);
    pdf.moveDown();
    const f = booking.fare;
    const rows = [
        ['Base fare', f.base],
        ['Distance', f.distance],
        ['Time', f.time],
        ['Waiting', f.waiting],
        ['Night charge', f.night],
        ['Additional stops', f.extraStops],
        ['Loading / unloading', f.loading],
        ['Platform fee', f.platformFee],
        ['Taxes', f.tax],
        ['Discount', -f.discount],
    ];
    for (const [label, amount] of rows.filter(([, a]) => a !== 0))
        pdf.text(label, 50, pdf.y, { continued: true, width: 300 }).text(money(amount), { align: 'right' });
    pdf.moveDown(0.5).fontSize(12).text('Total', 50, pdf.y, { continued: true, width: 300 }).text(money(f.total), { align: 'right' });
    if (f.tip)
        pdf.fontSize(10).text('Tip to rider', 50, pdf.y, { continued: true, width: 300 }).text(money(f.tip), { align: 'right' });
    pdf.moveDown().fontSize(10).text(`Payment: ${booking.paymentMethod.toUpperCase()} · ${booking.paymentStatus}`);
    pdf.end();
}
//# sourceMappingURL=common.controller.js.map