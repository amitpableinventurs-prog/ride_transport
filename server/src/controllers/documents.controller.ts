import type { Request, Response } from 'express'
import { Types } from 'mongoose'
import { DocumentRecord } from '../models/Document'
import { Vehicle } from '../models/Vehicle'
import { recordAudit } from '../utils/audit'

function parsePagination(req: Request) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20))
  return { page, limit, skip: (page - 1) * limit }
}

export async function listDocuments(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req)
  const ownerType = typeof req.query.ownerType === 'string' ? req.query.ownerType : undefined
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const ownerId = typeof req.query.ownerId === 'string' ? req.query.ownerId : undefined
  const docType = typeof req.query.docType === 'string' ? req.query.docType : undefined

  const filter: Record<string, unknown> = {}
  if (ownerType) filter.ownerType = ownerType
  if (status) filter.status = status
  if (docType) filter.docType = docType
  if (ownerId) {
    if (!Types.ObjectId.isValid(ownerId)) {
      res.status(400).json({ message: 'ownerId is not a valid id' })
      return
    }
    filter.ownerId = new Types.ObjectId(ownerId)
  }

  const [items, total] = await Promise.all([
    DocumentRecord.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    DocumentRecord.countDocuments(filter),
  ])

  res.json({ items, total, page, limit })
}

export async function createDocument(req: Request, res: Response) {
  const body = req.body as {
    ownerType?: 'driver' | 'partner' | 'vehicle'
    ownerId?: string
    docType?: string
    fileUrl?: string
    expiryDate?: string
  }

  if (!body.ownerType || !body.ownerId || !body.docType || !body.fileUrl) {
    res.status(400).json({ message: 'ownerType, ownerId, docType and fileUrl are required' })
    return
  }

  const doc = await DocumentRecord.create({
    ownerType: body.ownerType,
    ownerId: new Types.ObjectId(body.ownerId),
    docType: body.docType,
    fileUrl: body.fileUrl,
    expiryDate: body.expiryDate ? new Date(body.expiryDate) : undefined,
  })

  await recordAudit(req.admin!, 'document.create', 'DocumentRecord', `${doc.docType} (${doc.ownerType})`)

  res.status(201).json(doc)
}

export async function updateDocumentStatus(req: Request, res: Response) {
  const doc = await DocumentRecord.findById(req.params.id)
  if (!doc) {
    res.status(404).json({ message: 'Document not found' })
    return
  }

  const { status, rejectionReason } = req.body as {
    status?: 'pending' | 'verified' | 'rejected' | 'expired'
    rejectionReason?: string
  }
  if (!status || !['pending', 'verified', 'rejected', 'expired'].includes(status)) {
    res.status(400).json({ message: 'A valid status is required' })
    return
  }
  if (status === 'rejected' && !rejectionReason) {
    res.status(400).json({ message: 'A rejection reason is required when rejecting a document' })
    return
  }

  doc.status = status
  doc.rejectionReason = status === 'rejected' ? rejectionReason : undefined
  doc.reviewedBy = req.admin!._id
  doc.reviewedAt = new Date()
  await doc.save()

  // Keep the vehicle's documentsStatus in step with its RC (the rider app files the RC under the driver).
  if (doc.ownerType === 'vehicle' || doc.docType === 'vehicle_rc') {
    const vehicle =
      doc.ownerType === 'vehicle'
        ? await Vehicle.findById(doc.ownerId)
        : await Vehicle.findOne({ ownerType: 'driver', ownerId: doc.ownerId }).sort({ createdAt: -1 })
    if (vehicle) {
      vehicle.documentsStatus = status
      await vehicle.save()
    }
  }

  await recordAudit(req.admin!, 'document.status_changed', 'DocumentRecord', `${doc.docType} (${doc.ownerType})`, {
    status,
    rejectionReason,
  })

  res.json(doc)
}
