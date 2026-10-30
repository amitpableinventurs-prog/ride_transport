"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TICKET_CATEGORIES = void 0;
exports.raiseSos = raiseSos;
exports.listTickets = listTickets;
exports.getTicket = getTicket;
exports.createTicket = createTicket;
exports.listNotifications = listNotifications;
const AppNotification_1 = require("../../models/AppNotification");
const Booking_1 = require("../../models/Booking");
const NotificationBroadcast_1 = require("../../models/NotificationBroadcast");
const SosRequest_1 = require("../../models/SosRequest");
const Ticket_1 = require("../../models/Ticket");
const socket_1 = require("../../realtime/socket");
const geo_1 = require("../../utils/geo");
const http_1 = require("../../utils/http");
const sms_1 = require("../../utils/sms");
exports.TICKET_CATEGORIES = ['payment', 'booking', 'driver', 'vehicle', 'lost_item', 'refund', 'cancellation', 'technical'];
const ANNOUNCEMENT_DAYS = 30;
function personUser(req) {
    const user = req.appUser;
    if (user.type === 'partner')
        throw new http_1.HttpError(403, 'Not available for partner accounts');
    return user;
}
const displayName = (user) => user.doc.name || user.doc.phone;
/** Booking the user is part of (as customer or rider); 404 otherwise. */
async function ownBooking(user, bookingId) {
    const field = user.type === 'customer' ? 'customer' : 'driver';
    const booking = await Booking_1.Booking.findOne({ _id: (0, http_1.requireObjectId)(bookingId, 'bookingId'), [field]: user.doc._id });
    if (!booking)
        throw new http_1.HttpError(404, 'Booking not found');
    return booking;
}
// POST /sos
async function raiseSos(req, res) {
    const user = personUser(req);
    const body = req.body;
    const location = (0, geo_1.parseLatLng)(body.lat, body.lng);
    if (!location)
        throw new http_1.HttpError(400, 'lat and lng are required');
    const booking = body.bookingId ? await ownBooking(user, body.bookingId) : null;
    const note = (0, http_1.optionalString)(body.note, 500);
    const sos = await SosRequest_1.SosRequest.create({
        booking: booking?._id ?? null,
        raisedBy: user.type,
        userName: displayName(user),
        location,
        notes: note ? [{ by: displayName(user), text: note }] : [],
    });
    (0, socket_1.emitToAdmins)('sos:alert', {
        sosId: sos.id,
        user: { id: user.doc.id, type: user.type === 'driver' ? 'rider' : 'customer', name: displayName(user), phone: user.doc.phone },
        booking: booking ? { id: booking.id, bookingCode: booking.bookingCode, status: booking.status } : null,
        location,
        createdAt: sos.createdAt,
    });
    // Alert the user's emergency contacts by SMS with a map link.
    const contacts = user.type === 'customer' && user.doc.emergencyContacts.length
        ? user.doc.emergencyContacts
        : user.doc.emergencyContact
            ? [user.doc.emergencyContact]
            : [];
    const mapLink = `https://maps.google.com/?q=${location.lat},${location.lng}`;
    const sms = (0, sms_1.getSmsProvider)();
    await Promise.all(contacts.map((c) => sms.send(c.phone, `SOS from ${displayName(user)} via AnZ Cabs${booking ? ` (trip ${booking.bookingCode})` : ''}. Location: ${mapLink}`).catch((err) => console.error('[sos] sms failed', err))));
    res.status(201).json({ sos, contactsNotified: contacts.length });
}
// GET /tickets
async function listTickets(req, res) {
    const user = personUser(req);
    const { page, limit, skip } = (0, http_1.parsePagination)(req);
    // Claims have their own screen (GET /claims).
    const filter = { raisedByType: user.type, raisedById: user.doc._id, category: { $ne: 'claim' } };
    const [items, total] = await Promise.all([
        Ticket_1.Ticket.find(filter).select('-assignedTo').populate('booking', 'bookingCode mode status').sort({ createdAt: -1 }).skip(skip).limit(limit),
        Ticket_1.Ticket.countDocuments(filter),
    ]);
    res.json({ items, total, page, limit });
}
// GET /tickets/:id: one ticket with support's replies (notes).
async function getTicket(req, res) {
    const user = personUser(req);
    const ticket = await Ticket_1.Ticket.findOne({ _id: (0, http_1.requireObjectId)(req.params.id, 'id'), raisedByType: user.type, raisedById: user.doc._id, category: { $ne: 'claim' } })
        .select('-assignedTo')
        .populate('booking', 'bookingCode mode status');
    if (!ticket)
        throw new http_1.HttpError(404, 'Ticket not found');
    res.json(ticket);
}
// POST /tickets
async function createTicket(req, res) {
    const user = personUser(req);
    const body = req.body;
    const category = body.category;
    if (!exports.TICKET_CATEGORIES.includes(category))
        throw new http_1.HttpError(400, `category must be one of: ${exports.TICKET_CATEGORIES.join(', ')}`);
    const booking = body.bookingId ? await ownBooking(user, body.bookingId) : null;
    const ticket = await Ticket_1.Ticket.create({
        subject: (0, http_1.requireString)(body.subject, 'subject', 150),
        description: (0, http_1.optionalString)(body.description, 2000),
        category,
        raisedByType: user.type,
        raisedById: user.doc._id,
        raisedByName: displayName(user),
        booking: booking?._id ?? null,
    });
    res.status(201).json(ticket);
}
// GET /notifications: personal inbox plus recent announcements (admin broadcasts).
async function listNotifications(req, res) {
    const user = personUser(req);
    const { page, limit, skip } = (0, http_1.parsePagination)(req);
    const filter = { userType: user.type, userId: user.doc._id };
    const since = new Date(Math.max(user.doc.createdAt.getTime(), Date.now() - ANNOUNCEMENT_DAYS * 86_400_000));
    const [items, total, unreadCount, announcements] = await Promise.all([
        AppNotification_1.AppNotification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        AppNotification_1.AppNotification.countDocuments(filter),
        AppNotification_1.AppNotification.countDocuments({ ...filter, readAt: null }),
        NotificationBroadcast_1.NotificationBroadcast.find({
            channel: 'push',
            audience: user.type === 'customer' ? 'all_customers' : 'all_drivers',
            createdAt: { $gte: since },
        })
            .select('title body serviceModeFilter createdAt')
            .sort({ createdAt: -1 })
            .limit(20),
    ]);
    // Opening the inbox marks this page as read.
    const unreadIds = items.filter((n) => !n.readAt).map((n) => n._id);
    if (unreadIds.length)
        await AppNotification_1.AppNotification.updateMany({ _id: { $in: unreadIds } }, { readAt: new Date() });
    res.json({ items, total, page, limit, unreadCount, announcements });
}
//# sourceMappingURL=support.controller.js.map