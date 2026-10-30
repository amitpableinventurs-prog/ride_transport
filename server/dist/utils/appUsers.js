"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAppUserByPhone = findAppUserByPhone;
exports.findAppUserById = findAppUserById;
exports.isAppUserActive = isAppUserActive;
exports.isProfileComplete = isProfileComplete;
exports.serializeAppUser = serializeAppUser;
const Customer_1 = require("../models/Customer");
const Driver_1 = require("../models/Driver");
const TransportPartner_1 = require("../models/TransportPartner");
async function findAppUserByPhone(type, phone) {
    switch (type) {
        case 'customer': {
            const doc = await Customer_1.Customer.findOne({ phone });
            return doc ? { type, doc } : null;
        }
        case 'driver': {
            const doc = await Driver_1.Driver.findOne({ phone });
            return doc ? { type, doc } : null;
        }
        case 'partner': {
            const doc = await TransportPartner_1.TransportPartner.findOne({ phone });
            return doc ? { type, doc } : null;
        }
    }
}
async function findAppUserById(type, id) {
    switch (type) {
        case 'customer': {
            const doc = await Customer_1.Customer.findById(id);
            return doc ? { type, doc } : null;
        }
        case 'driver': {
            const doc = await Driver_1.Driver.findById(id);
            return doc ? { type, doc } : null;
        }
        case 'partner': {
            const doc = await TransportPartner_1.TransportPartner.findById(id);
            return doc ? { type, doc } : null;
        }
    }
}
function isAppUserActive(user) {
    return user.doc.status === 'active';
}
// Customers and riders/drivers need a name and an emergency contact (the app's
// Profile screen). The app shows that screen while this is false.
function isProfileComplete(user) {
    if (user.type === 'partner')
        return Boolean(user.doc.companyName && user.doc.ownerName);
    if (user.type === 'driver')
        return Boolean(user.doc.name && user.doc.photoUrl && user.doc.gender && user.doc.dateOfBirth);
    return Boolean(user.doc.name && user.doc.emergencyContact?.name && user.doc.emergencyContact?.phone);
}
function serializeAppUser(user) {
    return { ...user.doc.toJSON(), userType: user.type, profileComplete: isProfileComplete(user) };
}
//# sourceMappingURL=appUsers.js.map