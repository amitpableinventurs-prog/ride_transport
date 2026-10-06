import type { Request, Response } from 'express'
import { SosRequest, type SosRequestDocument } from '../models/SosRequest'
import { recordAudit } from '../utils/audit'

export async function listSosRequests(_req: Request, res: Response) {
  const requests = await SosRequest.find().sort({ createdAt: -1 }).populate('booking', 'bookingCode mode status')
  res.json(requests)
}

export async function updateSosRequest(req: Request, res: Response) {
  const { status, note } = req.body as { status?: SosRequestDocument['status']; note?: string }

  const sos = await SosRequest.findById(req.params.id)
  if (!sos) {
    res.status(404).json({ message: 'SOS request not found' })
    return
  }

  if (status) sos.status = status
  if (note) {
    sos.notes.push({ by: req.admin!.name, text: note, at: new Date() })
  }
  if (status === 'resolved') {
    sos.resolvedAt = new Date()
  }

  await sos.save()

  if (status === 'resolved') {
    await recordAudit(req.admin!, 'sos.status_changed', 'SosRequest', `${sos.userName} (${sos.raisedBy})`, { status, note })
  }

  res.json(sos)
}
