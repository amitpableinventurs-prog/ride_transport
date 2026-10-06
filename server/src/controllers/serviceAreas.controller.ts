import type { Request, Response } from 'express'
import type { FilterQuery } from 'mongoose'
import { ServiceArea, type ServiceAreaDocument } from '../models/ServiceArea'
import { recordAudit } from '../utils/audit'

const MUTABLE_FIELDS = ['name', 'country', 'state', 'city', 'zone', 'status', 'rideEnabled', 'transportEnabled', 'geofence'] as const

function pickMutableFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const key of MUTABLE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key]
  }
  return out
}

export async function listServiceAreas(req: Request, res: Response) {
  const { status, q } = req.query as { status?: string; q?: string }
  const filter: FilterQuery<ServiceAreaDocument> = {}
  if (status) filter.status = status as ServiceAreaDocument['status']
  if (q) {
    filter.$or = [
      { name: { $regex: q.trim(), $options: 'i' } },
      { city: { $regex: q.trim(), $options: 'i' } },
      { state: { $regex: q.trim(), $options: 'i' } },
    ]
  }
  const areas = await ServiceArea.find(filter).sort({ createdAt: -1 })
  res.json(areas)
}

export async function getServiceArea(req: Request, res: Response) {
  const area = await ServiceArea.findById(req.params.id)
  if (!area) {
    res.status(404).json({ message: 'Service area not found' })
    return
  }
  res.json(area)
}

export async function createServiceArea(req: Request, res: Response) {
  const body = req.body as Record<string, unknown>
  if (!body.name || !body.country || !body.state || !body.city) {
    res.status(400).json({ message: 'name, country, state and city are required' })
    return
  }

  const area = await ServiceArea.create(pickMutableFields(body))
  await recordAudit(req.admin!, 'service_area.create', 'ServiceArea', area.name)
  res.status(201).json(area)
}

export async function updateServiceArea(req: Request, res: Response) {
  const area = await ServiceArea.findById(req.params.id)
  if (!area) {
    res.status(404).json({ message: 'Service area not found' })
    return
  }

  const patch = pickMutableFields(req.body as Record<string, unknown>)
  Object.assign(area, patch)
  await area.save()

  await recordAudit(req.admin!, 'service_area.updated', 'ServiceArea', area.name, patch.status !== undefined ? { status: patch.status } : undefined)
  res.json(area)
}

export async function deleteServiceArea(req: Request, res: Response) {
  const area = await ServiceArea.findById(req.params.id)
  if (!area) {
    res.status(404).json({ message: 'Service area not found' })
    return
  }
  await area.deleteOne()
  await recordAudit(req.admin!, 'service_area.deleted', 'ServiceArea', area.name)
  res.status(204).end()
}
