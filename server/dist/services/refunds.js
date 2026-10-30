"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRefundableInfo = getRefundableInfo;
exports.createRefund = createRefund;
exports.processRefund = processRefund;
exports.applyGatewayRefundStatus = applyGatewayRefundStatus;
const Booking_1 = require("../models/Booking");
const Customer_1 = require("../models/Customer");
const Payment_1 = require("../models/Payment");
const Refund_1 = require("../models/Refund");
const http_1 = require("../utils/http");
const notify_1 = require("../utils/notify");
const payments_1 = require("../utils/payments");
const wallet_1 = require("../utils/wallet");
// Refunds still owed or already sent; rejected ones don't count against the booking total.
const OPEN_REFUND_STATUSES = ['requested', 'approved', 'processing', 'processed'];
async function findPaidBooking(ref) {
    const code = typeof ref.bookingCode === 'string' ? ref.bookingCode.trim().toUpperCase() : '';
    const id = typeof ref.bookingId === 'string' && /^[a-f\d]{24}$/i.test(ref.bookingId) ? ref.bookingId : '';
    if (!code && !id)
        throw new http_1.HttpError(400, 'bookingCode or bookingId is required');
    const booking = await Booking_1.Booking.findOne(id ? { _id: id } : { bookingCode: code }).select('bookingCode customer fare paymentStatus paymentMethod status');
    if (!booking)
        throw new http_1.HttpError(404, 'Booking not found');
    if (booking.paymentStatus !== 'paid' && booking.paymentStatus !== 'refunded')
        throw new http_1.HttpError(409, 'Only paid bookings can be refunded');
    return booking;
}
/** The Razorpay payment a refund can go back to, if the booking was paid online. */
function findGatewayPayment(bookingId) {
    return Payment_1.Payment.findOne({ booking: bookingId, gateway: 'razorpay', status: { $in: ['success', 'refunded'] }, gatewayRefId: { $exists: true, $ne: '' } });
}
async function refundedSoFar(bookingId, excludeRefund) {
    const [row] = await Refund_1.Refund.aggregate([
        { $match: { booking: bookingId, status: { $in: [...OPEN_REFUND_STATUSES] }, ...(excludeRefund ? { _id: { $ne: excludeRefund } } : {}) } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    return (0, http_1.roundMoney)(row?.total ?? 0);
}
/** What the admin sees before creating a refund: how much is left and where it will go. */
async function getRefundableInfo(ref) {
    const booking = await findPaidBooking(ref);
    const [payment, alreadyRefunded, customer] = await Promise.all([
        findGatewayPayment(booking._id),
        refundedSoFar(booking._id),
        Customer_1.Customer.findById(booking.customer).select('name phone'),
    ]);
    const paidTotal = booking.fare?.total ?? 0;
    return {
        bookingId: booking.id,
        bookingCode: booking.bookingCode,
        customer: customer ? { id: customer.id, name: customer.name, phone: customer.phone } : null,
        paidTotal,
        paidVia: payment ? 'online' : booking.paymentMethod,
        alreadyRefunded,
        maxRefundable: (0, http_1.roundMoney)(Math.max(0, paidTotal - alreadyRefunded)),
        destination: payment ? 'source' : 'wallet',
    };
}
async function createRefund(input) {
    const info = await getRefundableInfo(input);
    if (input.amount > info.maxRefundable) {
        throw new http_1.HttpError(400, `At most ₹${info.maxRefundable} can be refunded for this booking`, { maxRefundable: info.maxRefundable });
    }
    return Refund_1.Refund.create({ booking: info.bookingId, amount: input.amount, reason: input.reason, requestedBy: input.requestedBy });
}
async function markBookingRefundedIfFull(bookingId) {
    const booking = await Booking_1.Booking.findById(bookingId).select('fare paymentStatus');
    if (!booking)
        return;
    const [row] = await Refund_1.Refund.aggregate([{ $match: { booking: bookingId, status: 'processed' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]);
    if ((row?.total ?? 0) >= (booking.fare?.total ?? 0))
        await Booking_1.Booking.updateOne({ _id: bookingId, paymentStatus: 'paid' }, { $set: { paymentStatus: 'refunded' } });
}
async function sendToSource(refund, payment) {
    const provider = (0, payments_1.getPaymentProvider)();
    if (provider.name !== 'razorpay')
        throw new http_1.HttpError(503, 'Razorpay is not configured, so this online payment cannot be refunded to the bank right now');
    const remaining = (0, http_1.roundMoney)(payment.amount - (payment.refundedAmount ?? 0));
    if (refund.amount > remaining)
        throw new http_1.HttpError(400, `Only ₹${remaining} of this payment is left to refund`);
    const result = await provider.refundPayment(payment.gatewayRefId, refund.amount, `refund_${refund.id}`);
    const updated = await Payment_1.Payment.findByIdAndUpdate(payment._id, { $inc: { refundedAmount: refund.amount } }, { new: true });
    if (updated && updated.refundedAmount >= updated.amount)
        await Payment_1.Payment.updateOne({ _id: payment._id }, { $set: { status: 'refunded' } });
    return { destination: 'source', payment: payment._id, gatewayRefundId: result.id, gatewayStatus: result.status };
}
/**
 * Sends an approved refund: back to the original online payment through Razorpay when there is one,
 * otherwise (cash or wallet bookings) to the customer's wallet.
 */
async function processRefund(refundId) {
    const refund = await Refund_1.Refund.findOneAndUpdate({ _id: refundId, status: 'approved' }, { $set: { status: 'processing' } }, { new: true });
    if (!refund) {
        const existing = await Refund_1.Refund.findById(refundId).select('status');
        if (!existing)
            throw new http_1.HttpError(404, 'Refund not found');
        throw new http_1.HttpError(409, existing.status === 'processing' ? 'This refund is already being processed' : 'Only approved refunds can be processed');
    }
    // Once money has left (gateway refund or wallet credit) the refund must never go back to `approved`.
    let sent = false;
    try {
        const booking = await Booking_1.Booking.findById(refund.booking).select('customer bookingCode');
        if (!booking)
            throw new http_1.HttpError(404, 'Related booking not found');
        const payment = refund.payment ? await Payment_1.Payment.findOne({ _id: refund.payment, gateway: 'razorpay' }) : await findGatewayPayment(booking._id);
        let outcome;
        if (payment) {
            outcome = await sendToSource(refund, payment);
        }
        else {
            await (0, wallet_1.creditWallet)({ ownerType: 'customer', ownerId: booking.customer, amount: refund.amount, reason: 'refund', referenceType: 'Refund', referenceId: refund._id });
            outcome = { destination: 'wallet' };
        }
        sent = true;
        refund.set({ ...outcome, status: 'processed', processedAt: new Date() });
        await refund.save();
        await markBookingRefundedIfFull(booking._id);
        await (0, notify_1.notifyUser)('customer', booking.customer, {
            title: 'Refund processed',
            body: outcome.destination === 'source'
                ? `₹${refund.amount} for ${booking.bookingCode} is on its way to your original payment method. It can take 5-7 working days to show up.`
                : `₹${refund.amount} for ${booking.bookingCode} has been added to your AnZ Cabs wallet.`,
            data: { type: 'refund', bookingId: booking.id, refundId: refund.id },
        });
        return { refund, bookingCode: booking.bookingCode };
    }
    catch (err) {
        if (sent) {
            console.error(`[refunds] ${refund.id} was sent but its record could not be updated; it stays in processing`, err);
        }
        else {
            // Nothing was sent: put it back so the admin can try again.
            await Refund_1.Refund.updateOne({ _id: refund._id, status: 'processing' }, { $set: { status: 'approved' } });
        }
        throw err;
    }
}
/**
 * Razorpay refund webhook. A refund the bank could not complete goes to the customer's wallet instead,
 * so the customer is never left without their money.
 */
async function applyGatewayRefundStatus(gatewayRefundId, status) {
    if (status === 'processed') {
        await Refund_1.Refund.updateOne({ gatewayRefundId, gatewayStatus: { $ne: 'failed' } }, { $set: { gatewayStatus: 'processed' } });
        return;
    }
    const refund = await Refund_1.Refund.findOneAndUpdate({ gatewayRefundId, gatewayStatus: { $ne: 'failed' } }, { $set: { gatewayStatus: 'failed', destination: 'wallet' } }, { new: true });
    if (!refund)
        return;
    if (refund.payment)
        await Payment_1.Payment.updateOne({ _id: refund.payment }, [{ $set: { refundedAmount: { $max: [0, { $subtract: ['$refundedAmount', refund.amount] }] }, status: 'success' } }]);
    const booking = await Booking_1.Booking.findById(refund.booking).select('customer bookingCode');
    if (!booking)
        return;
    await (0, wallet_1.creditWallet)({ ownerType: 'customer', ownerId: booking.customer, amount: refund.amount, reason: 'refund', referenceType: 'Refund', referenceId: refund._id });
    console.warn(`[refunds] Razorpay refund ${gatewayRefundId} failed; ₹${refund.amount} credited to the customer's wallet instead`);
    await (0, notify_1.notifyUser)('customer', booking.customer, {
        title: 'Refund added to your wallet',
        body: `Your bank could not accept the ₹${refund.amount} refund for ${booking.bookingCode}, so it has been added to your AnZ Cabs wallet.`,
        data: { type: 'refund', bookingId: booking.id, refundId: refund.id },
    });
}
//# sourceMappingURL=refunds.js.map