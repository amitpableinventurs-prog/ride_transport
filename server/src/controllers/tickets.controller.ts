import type { Request, Response } from 'express'
import { Types, type FilterQuery } from 'mongoose'
import { Ticket, type TicketDocument } from '../models/Ticket'
import { recordAudit } from '../utils/audit'
import { searchRegex } from '../utils/regex'

const ASSIGNEE_FIELDS = 'name email'

export async function listTickets(req: Request, res: Response) {
  const { category, status, priority, q } = req.query as { category?: string; status?: string; priority?: string; q?: string }
  const filter: FilterQuery<TicketDocument> = {}
  if (category) filter.category = category as TicketDocument['category']
  if (status) filter.status = status as TicketDocument['status']
  if (priority) filter.priority = priority as TicketDocument['priority']
  if (q) {
    filter.$or = [{ subject: { $regex: searchRegex(q), $options: 'i' } }, { raisedByName: { $regex: searchRegex(q), $options: 'i' } }]
  }

  const tickets = await Ticket.find(filter).populate('assignedTo', ASSIGNEE_FIELDS).sort({ createdAt: -1 })
  res.json(tickets)
}

export async function getTicket(req: Request, res: Response) {
  const ticket = await Ticket.findById(req.params.id).populate('assignedTo', ASSIGNEE_FIELDS)
  if (!ticket) {
    res.status(404).json({ message: 'Ticket not found' })
    return
  }
  res.json(ticket)
}

export async function updateTicket(req: Request, res: Response) {
  const ticket = await Ticket.findById(req.params.id)
  if (!ticket) {
    res.status(404).json({ message: 'Ticket not found' })
    return
  }

  const body = req.body as Partial<{
    status: TicketDocument['status']
    priority: TicketDocument['priority']
    assignedTo: string | null
    note: string
  }>

  const previousStatus = ticket.status
  let statusChanged = false

  if (body.status !== undefined && body.status !== ticket.status) {
    ticket.status = body.status
    statusChanged = true
    if (body.status === 'resolved' || body.status === 'closed') {
      ticket.resolvedAt = new Date()
    } else {
      ticket.resolvedAt = undefined
    }
  }
  if (body.priority !== undefined) ticket.priority = body.priority
  if (body.assignedTo !== undefined) {
    ticket.assignedTo = body.assignedTo ? new Types.ObjectId(body.assignedTo) : null
    if (ticket.status === 'open' && body.assignedTo) {
      ticket.status = 'assigned'
      statusChanged = true
    }
  }
  if (body.note !== undefined && body.note.trim()) {
    ticket.notes.push({ by: req.admin!.name, text: body.note.trim(), at: new Date() })
  }

  await ticket.save()

  if (statusChanged) {
    await recordAudit(req.admin!, 'ticket.status_changed', 'Ticket', ticket.subject, { from: previousStatus, to: ticket.status })
  }

  const populated = await ticket.populate('assignedTo', ASSIGNEE_FIELDS)
  res.json(populated)
}
