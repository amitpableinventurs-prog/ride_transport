"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listRatings = listRatings;
const Rating_1 = require("../models/Rating");
// Importing Booking/Customer/Driver here registers their Mongoose models for populate(),
// independent of whether other in-progress phases have imported them yet.
require("../models/Booking");
require("../models/Customer");
require("../models/Driver");
async function listRatings(req, res) {
    const { ratedBy, minScore } = req.query;
    const filter = {};
    if (ratedBy)
        filter.ratedBy = ratedBy;
    if (minScore)
        filter.score = { $gte: Number(minScore) };
    const ratings = await Rating_1.Rating.find(filter)
        .populate('booking', 'bookingCode')
        .populate('customer', 'name')
        .populate('driver', 'name')
        .sort({ createdAt: -1 });
    res.json(ratings);
}
//# sourceMappingURL=ratings.controller.js.map