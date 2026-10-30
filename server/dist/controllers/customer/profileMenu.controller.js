"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfileMenu = getProfileMenu;
exports.getHelp = getHelp;
exports.getSafety = getSafety;
exports.listClaims = listClaims;
exports.getClaim = getClaim;
exports.createClaim = createClaim;
exports.getSettings = getSettings;
exports.updateSettings = updateSettings;
const env_1 = require("../../config/env");
const AppNotification_1 = require("../../models/AppNotification");
const Booking_1 = require("../../models/Booking");
const CmsPage_1 = require("../../models/CmsPage");
const Ticket_1 = require("../../models/Ticket");
const trips_1 = require("../../services/trips");
const appUsers_1 = require("../../utils/appUsers");
const http_1 = require("../../utils/http");
const settings_1 = require("../../utils/settings");
const uploads_1 = require("../../utils/uploads");
const profile_controller_1 = require("../app/profile.controller");
const support_controller_1 = require("../app/support.controller");
const account_controller_1 = require("./account.controller");
const CLAIM_WINDOW_DAYS = 7;
const CLAIM_PHOTO_FIELDS = ['photo1', 'photo2', 'photo3'];
const CLOSED_TICKET_STATUSES = ['resolved', 'closed'];
const BOOKING_BRIEF_FIELDS = 'bookingCode mode status pickup drop stops.address fare.total createdAt completedAt';
function customerDoc(req) {
    return req.appUser.doc;
}
// ---------- Profile menu ----------
// GET /profile/menu: everything the Profile tab shows in one call (header card, menu rows with their subtitles and
// badges, and the "Become a partner" banner). Each row's `key` tells the app which screen to open.
async function getProfileMenu(req, res) {
    const customer = customerDoc(req);
    const [settings, unreadNotifications, openClaims] = await Promise.all([
        (0, settings_1.getPlatformSettings)(),
        AppNotification_1.AppNotification.countDocuments({ userType: 'customer', userId: customer._id, readAt: null }),
        Ticket_1.Ticket.countDocuments({ raisedByType: 'customer', raisedById: customer._id, category: 'claim', status: { $nin: CLOSED_TICKET_STATUSES } }),
    ]);
    res.json({
        user: { id: customer.id, name: customer.name, phone: customer.phone, photoUrl: customer.photoUrl ?? null, rating: customer.rating, ridePin: await (0, trips_1.ensureRidePin)(customer._id), profileComplete: (0, appUsers_1.isProfileComplete)(req.appUser) },
        items: [
            { key: 'help', title: 'Help' },
            { key: 'payment', title: 'Payment' },
            { key: 'my_rides', title: 'My Rides' },
            { key: 'my_shipments', title: 'My Shipments' },
            { key: 'safety', title: 'Safety' },
            ...(settings.referralEnabled ? [{ key: 'refer_and_earn', title: 'Refer and Earn', subtitle: `Get ₹${settings.referralRewardReferrer}` }] : []),
            { key: 'my_rewards', title: 'My Rewards' },
            { key: 'coins', title: `${settings.platformName} Coins`, badge: customer.coins || null },
            { key: 'notifications', title: 'Notifications', badge: unreadNotifications || null },
            { key: 'claims', title: 'Claims', badge: openClaims || null },
            { key: 'settings', title: 'Settings' },
        ].map((item) => ({ subtitle: null, badge: null, ...item })),
        partner: { title: `Earn money with ${settings.platformName}`, subtitle: 'Become a partner', url: env_1.env.riderAppUrl || null },
    });
}
// ---------- Help ----------
const TICKET_CATEGORY_LABELS = {
    payment: 'Payment',
    booking: 'Booking',
    driver: 'Rider behaviour',
    vehicle: 'Vehicle',
    lost_item: 'Lost item',
    refund: 'Refund',
    cancellation: 'Cancellation',
    technical: 'App issue',
};
// GET /help: support contacts, FAQ, ticket categories for "Raise a ticket", and the latest trips to ask about.
async function getHelp(req, res) {
    const customer = customerDoc(req);
    const [settings, faq, recentBookings, openTickets] = await Promise.all([
        (0, settings_1.getPlatformSettings)(),
        CmsPage_1.CmsPage.findOne({ slug: 'faq' }).select('title content updatedAt'),
        Booking_1.Booking.find({ customer: customer._id }).select(BOOKING_BRIEF_FIELDS).sort({ createdAt: -1 }).limit(3),
        Ticket_1.Ticket.countDocuments({ raisedByType: 'customer', raisedById: customer._id, category: { $ne: 'claim' }, status: { $nin: CLOSED_TICKET_STATUSES } }),
    ]);
    res.json({
        support: { phone: settings.supportPhone, email: settings.supportEmail },
        faq: faq ? { title: faq.title, content: faq.content, updatedAt: faq.updatedAt } : null,
        ticketCategories: support_controller_1.TICKET_CATEGORIES.map((key) => ({ key, name: TICKET_CATEGORY_LABELS[key] })),
        recentBookings,
        openTickets,
    });
}
// ---------- Safety ----------
const SAFETY_TIPS = [
    { title: 'Check before you board', description: "Match the vehicle number, the rider's photo and name with the app before starting the trip." },
    { title: 'Share your trip', description: 'Send your live trip link to family or friends from the trip screen.' },
    { title: 'Use SOS in an emergency', description: 'SOS alerts our safety team and sends your location to your emergency contacts.' },
    { title: 'Keep your OTP private', description: 'Give the start OTP to the rider only after you are in the right vehicle.' },
    { title: 'Calls stay private', description: 'Call the rider from the app. Your number is not shared.' },
];
// GET /safety: emergency contacts, the ongoing trip (for SOS and sharing) and safety tips.
async function getSafety(req, res) {
    const customer = customerDoc(req);
    const [settings, ongoing] = await Promise.all([
        (0, settings_1.getPlatformSettings)(),
        Booking_1.Booking.findOne({ customer: customer._id, status: { $in: Booking_1.OPEN_BOOKING_STATUSES } }).select('bookingCode mode status').sort({ createdAt: -1 }),
    ]);
    res.json({
        emergencyContacts: { contacts: (0, account_controller_1.contactsOf)(customer), max: account_controller_1.MAX_EMERGENCY_CONTACTS },
        ongoingBooking: ongoing,
        support: { phone: settings.supportPhone },
        tips: SAFETY_TIPS,
    });
}
// ---------- Claims ----------
const CLAIM_TYPE_LABELS = {
    damaged_goods: 'Goods damaged',
    lost_goods: 'Goods lost or missing',
    overcharged: 'Charged too much',
    other: 'Something else',
};
const GOODS_CLAIMS = ['damaged_goods', 'lost_goods'];
function serializeClaim(ticket) {
    return {
        id: ticket.id,
        type: ticket.claim?.type,
        title: CLAIM_TYPE_LABELS[ticket.claim.type],
        description: ticket.description,
        amount: ticket.claim?.amount ?? null,
        photos: ticket.claim?.photos ?? [],
        booking: ticket.booking,
        status: ticket.status,
        notes: ticket.notes,
        resolvedAt: ticket.resolvedAt ?? null,
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
    };
}
const ownClaims = (customer) => ({ raisedByType: 'customer', raisedById: customer._id, category: 'claim' });
// GET /claims?page=&limit=: my claims, newest first, plus the claim types for the "New claim" form.
async function listClaims(req, res) {
    const filter = ownClaims(customerDoc(req));
    const { page, limit, skip } = (0, http_1.parsePagination)(req);
    const [items, total] = await Promise.all([
        Ticket_1.Ticket.find(filter).populate('booking', 'bookingCode mode status').sort({ createdAt: -1 }).skip(skip).limit(limit),
        Ticket_1.Ticket.countDocuments(filter),
    ]);
    res.json({
        types: Ticket_1.CLAIM_TYPES.map((key) => ({ key, name: CLAIM_TYPE_LABELS[key], transportOnly: GOODS_CLAIMS.includes(key) })),
        windowDays: CLAIM_WINDOW_DAYS,
        items: items.map(serializeClaim),
        total,
        page,
        limit,
    });
}
// GET /claims/:id
async function getClaim(req, res) {
    const claim = await Ticket_1.Ticket.findOne({ _id: (0, http_1.requireObjectId)(req.params.id, 'id'), ...ownClaims(customerDoc(req)) }).populate('booking', 'bookingCode mode status');
    if (!claim)
        throw new http_1.HttpError(404, 'Claim not found');
    res.json(serializeClaim(claim));
}
// POST /claims (multipart): bookingId, type, description, optional amount and photos (photo1-photo3).
// Shows up in the admin panel's Tickets list under the "Claim" category.
async function createClaim(req, res) {
    const customer = customerDoc(req);
    const body = req.body;
    const type = body.type;
    if (!Ticket_1.CLAIM_TYPES.includes(type))
        throw new http_1.HttpError(400, `type must be one of: ${Ticket_1.CLAIM_TYPES.join(', ')}`);
    const description = (0, http_1.requireString)(body.description, 'description', 2000);
    const amount = body.amount === undefined || body.amount === '' ? undefined : (0, http_1.parseAmount)(body.amount, 'amount', { min: 1 });
    const booking = await Booking_1.Booking.findOne({ _id: (0, http_1.requireObjectId)(body.bookingId, 'bookingId'), customer: customer._id }).select('bookingCode mode status completedAt updatedAt');
    if (!booking)
        throw new http_1.HttpError(404, 'Booking not found');
    if (!['completed', 'cancelled'].includes(booking.status))
        throw new http_1.HttpError(409, 'You can raise a claim once the booking is completed or cancelled');
    if (GOODS_CLAIMS.includes(type) && booking.mode !== 'transport')
        throw new http_1.HttpError(400, 'Goods claims are only for shipments');
    const endedAt = booking.completedAt ?? booking.updatedAt;
    if (Date.now() - endedAt.getTime() > CLAIM_WINDOW_DAYS * 86_400_000)
        throw new http_1.HttpError(409, `Claims must be raised within ${CLAIM_WINDOW_DAYS} days of the trip`);
    const open = await Ticket_1.Ticket.exists({ ...ownClaims(customer), booking: booking._id, status: { $nin: CLOSED_TICKET_STATUSES } });
    if (open)
        throw new http_1.HttpError(409, 'You already have an open claim for this booking');
    const files = (req.files ?? {});
    const photos = CLAIM_PHOTO_FIELDS.flatMap((field) => files[field] ?? []).map((file) => (0, uploads_1.uploadedFileUrl)('claims', file));
    const claim = await Ticket_1.Ticket.create({
        subject: `${CLAIM_TYPE_LABELS[type]} (${booking.bookingCode})`,
        description,
        category: 'claim',
        priority: GOODS_CLAIMS.includes(type) ? 'high' : 'medium',
        raisedByType: 'customer',
        raisedById: customer._id,
        raisedByName: customer.name || customer.phone,
        booking: booking._id,
        claim: { type, amount, photos },
    });
    await claim.populate('booking', 'bookingCode mode status');
    res.status(201).json(serializeClaim(claim));
}
// ---------- Settings ----------
async function settingsResponse(customer) {
    const s = await (0, settings_1.getPlatformSettings)();
    return {
        language: customer.language,
        notifications: { tripUpdates: true, offers: customer.notificationPrefs?.offers ?? true },
        support: { phone: s.supportPhone, email: s.supportEmail },
        legal: { terms: '/api/v1/customer/terms', privacyPolicy: '/api/v1/customer/privacy-policy' },
        deletionRequestedAt: customer.deletionRequestedAt ?? null,
    };
}
// GET /settings: the Settings screen. Language names come from GET /common/app-config.
async function getSettings(req, res) {
    res.json(await settingsResponse(customerDoc(req)));
}
// PATCH /settings { language?, notifications?: { offers } }: trip and payment notifications cannot be switched off.
async function updateSettings(req, res) {
    const customer = customerDoc(req);
    const body = (req.body ?? {});
    if (body.language !== undefined) {
        if (!profile_controller_1.APP_LANGUAGES.includes(body.language))
            throw new http_1.HttpError(400, `language must be one of: ${profile_controller_1.APP_LANGUAGES.join(', ')}`);
        customer.set('language', body.language);
    }
    const offers = body.notifications?.offers;
    if (offers !== undefined) {
        if (typeof offers !== 'boolean')
            throw new http_1.HttpError(400, 'notifications.offers must be true or false');
        customer.set('notificationPrefs.offers', offers);
    }
    await customer.save();
    res.json(await settingsResponse(customer));
}
//# sourceMappingURL=profileMenu.controller.js.map