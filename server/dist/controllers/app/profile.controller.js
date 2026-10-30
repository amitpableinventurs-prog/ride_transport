"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APP_LANGUAGES = void 0;
exports.getProfile = getProfile;
exports.updateProfile = updateProfile;
const appUsers_1 = require("../../utils/appUsers");
const profileInput_1 = require("../../utils/profileInput");
const phone_1 = require("../../utils/phone");
const uploads_1 = require("../../utils/uploads");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
exports.APP_LANGUAGES = ['en', 'hi', 'mr', 'gu', 'bn', 'ta', 'te', 'kn', 'ml', 'pa', 'or'];
function optionalString(value) {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
// GET /profile
async function getProfile(req, res) {
    res.json((0, appUsers_1.serializeAppUser)(req.appUser));
}
// PATCH /profile: send only the fields that changed.
async function updateProfile(req, res) {
    const user = req.appUser;
    const body = req.body;
    // The phone number is the login identity verified by OTP; the app may echo it back but not change it here.
    if (body.phone !== undefined && (0, phone_1.normalizeIndianMobile)(body.phone) !== user.doc.phone) {
        res.status(400).json({ message: 'Phone number cannot be changed from the profile' });
        return;
    }
    if (user.type === 'partner') {
        const email = body.email === undefined ? undefined : optionalString(body.email)?.toLowerCase() ?? null;
        if (email && !EMAIL_RE.test(email)) {
            res.status(400).json({ message: 'Enter a valid email address' });
            return;
        }
        for (const key of ['companyName', 'ownerName']) {
            if (body[key] === undefined)
                continue;
            const value = optionalString(body[key]);
            if (!value) {
                res.status(400).json({ message: `${key} cannot be empty` });
                return;
            }
            user.doc.set(key, value);
        }
        for (const key of ['businessRegNo', 'taxId']) {
            if (body[key] !== undefined)
                user.doc.set(key, optionalString(body[key]));
        }
        if (email !== undefined)
            user.doc.set('email', email ?? undefined);
        await user.doc.save();
        res.json((0, appUsers_1.serializeAppUser)(user));
        return;
    }
    // Multipart requests (photo upload) send emergencyContact as a JSON string.
    if (typeof body.emergencyContact === 'string') {
        try {
            body.emergencyContact = JSON.parse(body.emergencyContact);
        }
        catch {
            res.status(400).json({ message: 'emergencyContact must be a JSON object' });
            return;
        }
    }
    const parsed = (0, profileInput_1.parseProfileInput)(body, {
        ownPhone: user.doc.phone,
        partial: true,
        minAge: user.type === 'driver' ? profileInput_1.DRIVER_MIN_AGE : undefined,
    });
    if (!parsed.ok) {
        res.status(400).json({ message: parsed.message });
        return;
    }
    // null means "clear this field".
    for (const [key, value] of Object.entries(parsed.value)) {
        user.doc.set(key, value ?? undefined);
    }
    if (user.type === 'customer' && body.city !== undefined) {
        user.doc.set('city', optionalString(body.city));
    }
    // The Profile screen's emergency contact is the first SOS contact.
    if (user.type === 'customer' && parsed.value.emergencyContact) {
        const [, ...others] = user.doc.emergencyContacts;
        user.doc.set('emergencyContacts', [parsed.value.emergencyContact, ...others.filter((c) => c.phone !== parsed.value.emergencyContact.phone)]);
    }
    if (body.language !== undefined) {
        if (!exports.APP_LANGUAGES.includes(body.language)) {
            res.status(400).json({ message: `language must be one of: ${exports.APP_LANGUAGES.join(', ')}` });
            return;
        }
        user.doc.set('language', body.language);
    }
    // Photo: a multipart file in "photo", or a URL (e.g. from an earlier upload); null removes it.
    if (req.file) {
        user.doc.set('photoUrl', (0, uploads_1.uploadedFileUrl)('profile', req.file));
    }
    else if (body.photoUrl !== undefined) {
        const url = optionalString(body.photoUrl);
        if (url && !/^(https:\/\/|\/uploads\/)/.test(url)) {
            res.status(400).json({ message: 'photoUrl must be an https URL' });
            return;
        }
        user.doc.set('photoUrl', url);
    }
    await user.doc.save();
    res.json((0, appUsers_1.serializeAppUser)(user));
}
//# sourceMappingURL=profile.controller.js.map