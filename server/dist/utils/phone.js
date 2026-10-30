"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeIndianMobile = normalizeIndianMobile;
exports.maskPhone = maskPhone;
// The platform currently operates in India only (Settings.defaultCountry), so app
// phone numbers are normalized to +91 followed by a 10-digit mobile number.
function normalizeIndianMobile(input) {
    if (typeof input !== 'string')
        return null;
    const digits = input.replace(/\D/g, '');
    let local = digits;
    if (digits.length === 12 && digits.startsWith('91'))
        local = digits.slice(2);
    else if (digits.length === 11 && digits.startsWith('0'))
        local = digits.slice(1);
    return /^[6-9]\d{9}$/.test(local) ? `+91${local}` : null;
}
function maskPhone(phone) {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4)
        return '****';
    return `******${digits.slice(-4)}`;
}
//# sourceMappingURL=phone.js.map