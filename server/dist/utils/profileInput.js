"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DRIVER_MIN_AGE = void 0;
exports.parseProfileInput = parseProfileInput;
const personalProfile_1 = require("../models/personalProfile");
const phone_1 = require("./phone");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const NAME_MAX = 80;
/** Riders/drivers must be adults to drive on the platform. */
exports.DRIVER_MIN_AGE = 18;
function ageOn(dob, today) {
    let age = today.getUTCFullYear() - dob.getUTCFullYear();
    const beforeBirthday = today.getUTCMonth() < dob.getUTCMonth() || (today.getUTCMonth() === dob.getUTCMonth() && today.getUTCDate() < dob.getUTCDate());
    if (beforeBirthday)
        age -= 1;
    return age;
}
function cleanName(value) {
    if (typeof value !== 'string')
        return null;
    const name = value.trim().replace(/\s+/g, ' ');
    return name.length >= 2 && name.length <= NAME_MAX ? name : null;
}
/** Validates the Profile screen fields (name, email, gender, date of birth, emergency contact). */
function parseProfileInput(body, opts) {
    const value = {};
    const has = (key) => body[key] !== undefined;
    if (has('name') || !opts.partial) {
        const name = cleanName(body.name);
        if (!name)
            return { ok: false, message: `name is required (2-${NAME_MAX} characters)` };
        value.name = name;
    }
    if (has('email')) {
        const raw = typeof body.email === 'string' ? body.email.trim().toLowerCase() : body.email;
        if (raw === '' || raw === null)
            value.email = null;
        else if (typeof raw === 'string' && EMAIL_RE.test(raw))
            value.email = raw;
        else
            return { ok: false, message: 'Enter a valid email address' };
    }
    if (has('gender')) {
        if (body.gender === null || body.gender === '')
            value.gender = null;
        else if (personalProfile_1.GENDERS.includes(body.gender))
            value.gender = body.gender;
        else
            return { ok: false, message: `gender must be one of: ${personalProfile_1.GENDERS.join(', ')}` };
    }
    if (has('dateOfBirth')) {
        if (body.dateOfBirth === null || body.dateOfBirth === '') {
            value.dateOfBirth = null;
        }
        else {
            const match = typeof body.dateOfBirth === 'string' ? DATE_RE.exec(body.dateOfBirth) : null;
            const dob = match ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))) : null;
            // Reject impossible dates like 2001-02-30, which Date.UTC would roll over.
            if (!dob || dob.getUTCDate() !== Number(match[3]) || dob.getUTCFullYear() < 1900) {
                return { ok: false, message: 'dateOfBirth must be a valid date in YYYY-MM-DD format' };
            }
            const age = ageOn(dob, new Date());
            if (age < 0)
                return { ok: false, message: 'dateOfBirth cannot be in the future' };
            if (opts.minAge && age < opts.minAge)
                return { ok: false, message: `You must be at least ${opts.minAge} years old` };
            value.dateOfBirth = dob;
        }
    }
    if (has('emergencyContact') || !opts.partial) {
        const contact = body.emergencyContact;
        const name = cleanName(contact?.name);
        const phone = (0, phone_1.normalizeIndianMobile)(contact?.phone);
        if (!contact || typeof contact !== 'object' || !name || !phone) {
            return { ok: false, message: 'emergencyContact with a name and a valid 10-digit mobile number is required' };
        }
        if (phone === opts.ownPhone) {
            return { ok: false, message: 'Emergency contact must be a different phone number from your own' };
        }
        value.emergencyContact = { name, phone };
    }
    return { ok: true, value };
}
//# sourceMappingURL=profileInput.js.map