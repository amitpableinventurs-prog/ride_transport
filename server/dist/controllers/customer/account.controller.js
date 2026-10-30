"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_EMERGENCY_CONTACTS = void 0;
exports.listSavedPlaces = listSavedPlaces;
exports.addSavedPlace = addSavedPlace;
exports.deleteSavedPlace = deleteSavedPlace;
exports.contactsOf = contactsOf;
exports.getEmergencyContacts = getEmergencyContacts;
exports.putEmergencyContacts = putEmergencyContacts;
exports.nearbyAvailability = nearbyAvailability;
exports.listServices = listServices;
exports.validateCoupon = validateCoupon;
exports.listOffers = listOffers;
exports.listPaymentMethods = listPaymentMethods;
exports.listRewards = listRewards;
exports.getCoins = getCoins;
exports.requestAccountDeletion = requestAccountDeletion;
const Banner_1 = require("../../models/Banner");
const Booking_1 = require("../../models/Booking");
const Coupon_1 = require("../../models/Coupon");
const CoinTransaction_1 = require("../../models/CoinTransaction");
const Customer_1 = require("../../models/Customer");
const Driver_1 = require("../../models/Driver");
const ServiceCategory_1 = require("../../models/ServiceCategory");
const Vehicle_1 = require("../../models/Vehicle");
const coupons_1 = require("../../utils/coupons");
const geo_1 = require("../../utils/geo");
const WalletTransaction_1 = require("../../models/WalletTransaction");
const http_1 = require("../../utils/http");
const wallet_1 = require("../../utils/wallet");
const phone_1 = require("../../utils/phone");
const settings_1 = require("../../utils/settings");
const cache_1 = require("../../utils/cache");
const MAX_SAVED_PLACES = 10;
exports.MAX_EMERGENCY_CONTACTS = 3;
const RIDER_LOCATION_FRESH_MS = 5 * 60 * 1000;
function customerDoc(req) {
    return req.appUser.doc;
}
// ---------- Saved places ----------
// GET /saved-places
async function listSavedPlaces(req, res) {
    res.json(customerDoc(req).savedPlaces);
}
// POST /saved-places: Home and Work are unique (saving a new one replaces the old).
async function addSavedPlace(req, res) {
    const customer = customerDoc(req);
    const body = req.body;
    const label = body.label;
    if (!Customer_1.SAVED_PLACE_LABELS.includes(label))
        throw new http_1.HttpError(400, `label must be one of: ${Customer_1.SAVED_PLACE_LABELS.join(', ')}`);
    const place = (0, geo_1.parsePlace)(body, 'place');
    const address = (0, http_1.requireString)(body.address, 'address', 300);
    const name = label === 'other' ? (0, http_1.requireString)(body.name, 'name', 50) : (0, http_1.optionalString)(body.name, 50);
    if (label !== 'other')
        customer.savedPlaces.pull(...customer.savedPlaces.filter((p) => p.label === label).map((p) => p._id));
    if (customer.savedPlaces.length >= MAX_SAVED_PLACES)
        throw new http_1.HttpError(400, `You can save up to ${MAX_SAVED_PLACES} places`);
    customer.savedPlaces.push({ label, name, address, lat: place.lat, lng: place.lng });
    await customer.save();
    res.status(201).json(customer.savedPlaces[customer.savedPlaces.length - 1]);
}
// DELETE /saved-places/:id
async function deleteSavedPlace(req, res) {
    const customer = customerDoc(req);
    const place = customer.savedPlaces.id(req.params.id);
    if (!place)
        throw new http_1.HttpError(404, 'Saved place not found');
    place.deleteOne();
    await customer.save();
    res.status(204).send();
}
// ---------- Emergency (SOS) contacts ----------
function contactsOf(customer) {
    if (customer.emergencyContacts.length)
        return customer.emergencyContacts;
    return customer.emergencyContact ? [customer.emergencyContact] : [];
}
// GET /emergency-contacts
async function getEmergencyContacts(req, res) {
    res.json({ contacts: contactsOf(customerDoc(req)), max: exports.MAX_EMERGENCY_CONTACTS });
}
// PUT /emergency-contacts: replaces the whole list (1-3 contacts). The first is the Profile screen's contact.
async function putEmergencyContacts(req, res) {
    const customer = customerDoc(req);
    const raw = req.body.contacts;
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > exports.MAX_EMERGENCY_CONTACTS) {
        throw new http_1.HttpError(400, `contacts must be a list of 1 to ${exports.MAX_EMERGENCY_CONTACTS} people`);
    }
    const contacts = raw.map((c, i) => {
        const name = (0, http_1.optionalString)(c?.name, 80);
        const phone = (0, phone_1.normalizeIndianMobile)(c?.phone);
        if (!name || name.length < 2 || !phone)
            throw new http_1.HttpError(400, `Contact ${i + 1} needs a name and a valid 10-digit mobile number`);
        if (phone === customer.phone)
            throw new http_1.HttpError(400, 'Emergency contacts must be different from your own number');
        return { name, phone };
    });
    if (new Set(contacts.map((c) => c.phone)).size !== contacts.length)
        throw new http_1.HttpError(400, 'Each contact must have a different phone number');
    customer.set({ emergencyContacts: contacts, emergencyContact: contacts[0] });
    await customer.save();
    res.json({ contacts: customer.emergencyContacts, max: exports.MAX_EMERGENCY_CONTACTS });
}
// ---------- Services at a location ----------
/** Online riders within the dispatch radius and the nearest ETA, per category key. */
async function nearbyAvailability(point, radiusKm, categoryKeys) {
    // Shared for 10 seconds per ~100 m cell, so many phones opening the Home / Service tab cost one query.
    const key = `${point.lat.toFixed(3)},${point.lng.toFixed(3)}:${radiusKm}:${categoryKeys.join(',')}`;
    return availabilityCache.get(key, () => computeAvailability(point, radiusKm, categoryKeys));
}
const availabilityCache = new cache_1.TtlCache(10_000, 2000);
async function computeAvailability(point, radiusKm, categoryKeys) {
    const box = (0, geo_1.boundingBox)(point, radiusKm);
    const riders = await Driver_1.Driver.find({
        'currentLocation.lat': { $gte: box.minLat, $lte: box.maxLat },
        'currentLocation.lng': { $gte: box.minLng, $lte: box.maxLng },
        status: 'active',
        approvalStatus: 'verified',
        onlineStatus: 'online',
        'currentLocation.updatedAt': { $gte: new Date(Date.now() - RIDER_LOCATION_FRESH_MS) },
    }).select('currentLocation onboarding.services');
    const nearby = riders.filter((r) => (0, geo_1.haversineKm)(point, { lat: r.currentLocation.lat, lng: r.currentLocation.lng }) <= radiusKm);
    const vehicles = await Vehicle_1.Vehicle.find({ ownerType: 'driver', ownerId: { $in: nearby.map((r) => r._id) }, status: 'active' }).select('ownerId categoryKey');
    return new Map(categoryKeys.map((key) => {
        const eligible = nearby.filter((r) => r.onboarding?.services?.includes(key) || vehicles.some((v) => v.ownerId.equals(r._id) && v.categoryKey === key));
        const etas = eligible.map((r) => (0, geo_1.etaMinutes)({ lat: r.currentLocation.lat, lng: r.currentLocation.lng }, point));
        return [key, { ridersNearby: eligible.length, etaMin: etas.length ? Math.min(...etas) : null }];
    }));
}
// GET /services?lat=&lng=
async function listServices(req, res) {
    const point = (0, geo_1.parseLatLng)(req.query.lat, req.query.lng);
    if (!point)
        throw new http_1.HttpError(400, 'lat and lng query parameters are required');
    const [area, settings] = await Promise.all([(0, geo_1.findServiceArea)(point), (0, settings_1.getPlatformSettings)()]);
    if (!area) {
        res.json({ serviceable: false, message: "We don't operate at this location yet", serviceArea: null, ride: [], transport: [] });
        return;
    }
    const modes = [
        ...(settings.rideServiceEnabled && area.rideEnabled ? ['ride'] : []),
        ...(settings.transportServiceEnabled && area.transportEnabled ? ['transport'] : []),
    ];
    const categories = await ServiceCategory_1.ServiceCategory.find({ status: 'active', mode: { $in: modes } }).sort({ sortOrder: 1 });
    const availability = await nearbyAvailability(point, settings.dispatchRadiusKm, categories.map((c) => c.key));
    const items = categories.map((c) => ({
        key: c.key,
        mode: c.mode,
        name: c.name,
        description: c.description,
        icon: c.icon,
        seats: c.seats,
        capacityLabel: c.capacityLabel,
        ...availability.get(c.key),
    }));
    res.json({
        serviceable: true,
        serviceArea: { id: area.id, name: area.name, city: area.city },
        ride: items.filter((i) => i.mode === 'ride'),
        transport: items.filter((i) => i.mode === 'transport'),
    });
}
// ---------- Coupons and offers ----------
// POST /coupons/validate
async function validateCoupon(req, res) {
    const body = req.body;
    const code = (0, http_1.requireString)(body.code, 'code', 40);
    const categoryKey = (0, http_1.requireString)(body.categoryKey, 'categoryKey', 60);
    const fareTotal = (0, http_1.parseAmount)(body.fareTotal, 'fareTotal', { min: 0 });
    const category = await ServiceCategory_1.ServiceCategory.findOne({ key: categoryKey, status: 'active' });
    if (!category)
        throw new http_1.HttpError(400, 'Unknown vehicle category');
    const pickup = body.pickup ? (0, geo_1.parsePlace)(body.pickup, 'pickup') : null;
    const area = pickup ? await (0, geo_1.findServiceArea)(pickup) : null;
    try {
        const { code: normalized, discount, coupon } = await (0, coupons_1.applyCoupon)({
            code,
            customerId: customerDoc(req)._id,
            mode: category.mode,
            categoryKey,
            serviceAreaId: area?._id,
            fareTotal,
        });
        res.json({ valid: true, code: normalized, title: coupon.title, discount, payable: Math.max(0, fareTotal - discount) });
    }
    catch (err) {
        if (err instanceof http_1.HttpError && err.status === 400) {
            res.json({ valid: false, code: code.toUpperCase(), message: err.message });
            return;
        }
        throw err;
    }
}
// GET /offers
async function listOffers(_req, res) {
    const now = new Date();
    const [coupons, banners] = await Promise.all([
        Coupon_1.Coupon.find({ status: 'active', code: { $exists: true, $ne: null }, validFrom: { $lte: now }, validTo: { $gte: now } })
            .select('code title discountType amount maxDiscount minBookingAmount applicableMode applicableCategories validTo')
            .sort({ validTo: 1 }),
        Banner_1.Banner.find({ status: 'active', startDate: { $lte: now }, endDate: { $gte: now } })
            .select('title description imageUrl ctaLabel targetLink serviceMode')
            .sort({ startDate: -1 }),
    ]);
    res.json({ coupons, banners });
}
// ---------- Profile menu: Payment, My Rewards, anzcabs Coins ----------
// GET /payments/methods: the Payment screen. Online methods go through the payment gateway.
async function listPaymentMethods(req, res) {
    const wallet = await (0, wallet_1.getOrCreateWallet)('customer', customerDoc(req)._id);
    res.json({
        wallet: { balance: wallet.balance, currency: wallet.currency, dues: Math.max(0, -wallet.balance) },
        methods: [
            { key: 'cash', name: 'Cash', available: true },
            { key: 'wallet', name: 'AnZ Cabs Wallet', available: wallet.balance > 0, balance: wallet.balance },
            { key: 'upi', name: 'UPI', available: true },
            { key: 'card', name: 'Credit / Debit Card', available: true },
            { key: 'netbanking', name: 'Net Banking', available: true },
        ],
    });
}
/** Wallet credits shown on My Rewards. */
const REWARD_REASONS = ['referral', 'bonus'];
const REWARD_TITLES = { referral: 'Referral reward', bonus: 'Bonus from AnZ Cabs' };
// GET /rewards?page=&limit=: My Rewards. Referral rewards and bonuses credited to the wallet, plus the coins balance.
async function listRewards(req, res) {
    const customer = customerDoc(req);
    const { page, limit, skip } = (0, http_1.parsePagination)(req);
    const wallet = await (0, wallet_1.getOrCreateWallet)('customer', customer._id);
    const filter = { wallet: wallet._id, type: 'credit', reason: { $in: REWARD_REASONS } };
    const [items, total, totals] = await Promise.all([
        WalletTransaction_1.WalletTransaction.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
        WalletTransaction_1.WalletTransaction.countDocuments(filter),
        WalletTransaction_1.WalletTransaction.aggregate([{ $match: filter }, { $group: { _id: null, amount: { $sum: '$amount' } } }]),
    ]);
    // A referral credit points at the friend who joined (or who invited this customer).
    const friendIds = items.filter((t) => t.reason === 'referral' && t.referenceId).map((t) => t.referenceId);
    const friends = friendIds.length ? await Customer_1.Customer.find({ _id: { $in: friendIds } }).select('name') : [];
    const friendName = (id) => friends.find((f) => f._id.equals(id))?.name || null;
    res.json({
        totalEarned: totals[0]?.amount ?? 0,
        currency: wallet.currency,
        coins: { balance: customer.coins },
        items: items.map((t) => {
            const reason = t.reason;
            const friend = reason === 'referral' ? friendName(t.referenceId) : null;
            return {
                id: t.id,
                type: reason,
                title: REWARD_TITLES[reason],
                subtitle: friend ? `With ${friend}` : null,
                amount: t.amount,
                createdAt: t.createdAt,
            };
        }),
        total,
        page,
        limit,
    });
}
// GET /coins?page=&limit=: anzcabs Coins balance and history. Earning and redeeming rules are not set up yet.
async function getCoins(req, res) {
    const customer = customerDoc(req);
    const { page, limit, skip } = (0, http_1.parsePagination)(req);
    const filter = { customer: customer._id };
    const [items, total] = await Promise.all([
        CoinTransaction_1.CoinTransaction.find(filter).select('-customer').sort({ createdAt: -1 }).skip(skip).limit(limit),
        CoinTransaction_1.CoinTransaction.countDocuments(filter),
    ]);
    res.json({ balance: customer.coins, transactions: { items, total, page, limit } });
}
// ---------- Account ----------
// DELETE /account: records a deletion request; support completes it after settling dues and records.
async function requestAccountDeletion(req, res) {
    const customer = customerDoc(req);
    const open = await Booking_1.Booking.exists({ customer: customer._id, status: { $in: [...Booking_1.OPEN_BOOKING_STATUSES, 'scheduled'] } });
    if (open)
        throw new http_1.HttpError(409, 'Finish or cancel your ongoing and scheduled bookings before deleting your account');
    customer.set({ deletionRequestedAt: new Date(), deletionReason: (0, http_1.optionalString)((req.body ?? {}).reason, 500) });
    await customer.save();
    res.status(202).json({ message: 'Your account deletion request has been received. It will be completed within 7 days.' });
}
//# sourceMappingURL=account.controller.js.map