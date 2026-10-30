"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.duesLimitMessage = void 0;
exports.getRiderDues = getRiderDues;
exports.enforceDuesLimit = enforceDuesLimit;
const Booking_1 = require("../models/Booking");
const Driver_1 = require("../models/Driver");
const socket_1 = require("../realtime/socket");
const http_1 = require("../utils/http");
const notify_1 = require("../utils/notify");
const settings_1 = require("../utils/settings");
const wallet_1 = require("../utils/wallet");
const dispatch_1 = require("./dispatch");
async function getRiderDues(driverId) {
    const [wallet, settings] = await Promise.all([(0, wallet_1.getOrCreateWallet)('driver', driverId), (0, settings_1.getPlatformSettings)()]);
    const dues = (0, http_1.roundMoney)(Math.max(0, -wallet.balance));
    return { dues, limit: settings.maxCashDues, overLimit: dues > settings.maxCashDues };
}
const duesLimitMessage = ({ dues, limit }) => `Your dues of ₹${dues} are over the ₹${limit} limit. Pay your dues to go online.`;
exports.duesLimitMessage = duesLimitMessage;
/** Takes an online rider whose dues are over the limit offline and alerts them (once, when they go offline). */
async function enforceDuesLimit(driverId) {
    const status = await getRiderDues(driverId);
    if (!status.overLimit)
        return status;
    const result = await Driver_1.Driver.updateOne({ _id: driverId, onlineStatus: 'online' }, { $set: { onlineStatus: 'offline' } });
    if (!result.modifiedCount)
        return status;
    (0, socket_1.removeLiveRider)(driverId);
    const offered = await Booking_1.Booking.find({ status: 'requested', 'offer.driver': driverId }).select('_id');
    await Promise.all(offered.map((b) => (0, dispatch_1.rejectOffer)(b.id, driverId.toString())));
    const message = (0, exports.duesLimitMessage)(status);
    (0, socket_1.emitToRider)(driverId, 'rider:dues_limit', { ...status, onlineStatus: 'offline', message });
    await (0, notify_1.notifyUser)('driver', driverId, {
        title: 'Dues limit reached',
        body: message,
        data: { type: 'dues_limit', dues: String(status.dues), limit: String(status.limit) },
    });
    return status;
}
//# sourceMappingURL=riderDues.js.map