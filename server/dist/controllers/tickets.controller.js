"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listTickets = listTickets;
exports.getTicket = getTicket;
exports.updateTicket = updateTicket;
const mongoose_1 = require("mongoose");
const Ticket_1 = require("../models/Ticket");
const audit_1 = require("../utils/audit");
const regex_1 = require("../utils/regex");
const ASSIGNEE_FIELDS = 'name email';
async function listTickets(req, res) {
    const { category, status, priority, q } = req.query;
    const filter = {};
    if (category)
        filter.category = category;
    if (status)
        filter.status = status;
    if (priority)
        filter.priority = priority;
    if (q) {
        filter.$or = [{ subject: { $regex: (0, regex_1.searchRegex)(q), $options: 'i' } }, { raisedByName: { $regex: (0, regex_1.searchRegex)(q), $options: 'i' } }];
    }
    const tickets = await Ticket_1.Ticket.find(filter).populate('assignedTo', ASSIGNEE_FIELDS).sort({ createdAt: -1 });
    res.json(tickets);
}
async function getTicket(req, res) {
    const ticket = await Ticket_1.Ticket.findById(req.params.id).populate('assignedTo', ASSIGNEE_FIELDS);
    if (!ticket) {
        res.status(404).json({ message: 'Ticket not found' });
        return;
    }
    res.json(ticket);
}
async function updateTicket(req, res) {
    const ticket = await Ticket_1.Ticket.findById(req.params.id);
    if (!ticket) {
        res.status(404).json({ message: 'Ticket not found' });
        return;
    }
    const body = req.body;
    const previousStatus = ticket.status;
    let statusChanged = false;
    if (body.status !== undefined && body.status !== ticket.status) {
        ticket.status = body.status;
        statusChanged = true;
        if (body.status === 'resolved' || body.status === 'closed') {
            ticket.resolvedAt = new Date();
        }
        else {
            ticket.resolvedAt = undefined;
        }
    }
    if (body.priority !== undefined)
        ticket.priority = body.priority;
    if (body.assignedTo !== undefined) {
        ticket.assignedTo = body.assignedTo ? new mongoose_1.Types.ObjectId(body.assignedTo) : null;
        if (ticket.status === 'open' && body.assignedTo) {
            ticket.status = 'assigned';
            statusChanged = true;
        }
    }
    if (body.note !== undefined && body.note.trim()) {
        ticket.notes.push({ by: req.admin.name, text: body.note.trim(), at: new Date() });
    }
    await ticket.save();
    if (statusChanged) {
        await (0, audit_1.recordAudit)(req.admin, 'ticket.status_changed', 'Ticket', ticket.subject, { from: previousStatus, to: ticket.status });
    }
    const populated = await ticket.populate('assignedTo', ASSIGNEE_FIELDS);
    res.json(populated);
}
//# sourceMappingURL=tickets.controller.js.map