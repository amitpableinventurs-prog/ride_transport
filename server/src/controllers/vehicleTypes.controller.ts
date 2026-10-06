import type { Request, Response } from 'express'
import { VehicleType } from '../models/VehicleType'
import { recordAudit } from '../utils/audit'

function parsePagination(req: Request) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20))
  return { page, limit, skip: (page - 1) * limit }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export async function listVehicleTypes(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req)
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const serviceMode = typeof req.query.serviceMode === 'string' ? req.query.serviceMode : undefined
  const status = typeof req.query.status === 'string' ? req.query.status : undefined

  const filter: Record<string, unknown> = {}
  if (serviceMode) filter.serviceMode = serviceMode
  if (status) filter.status = status
  if (q) filter.name = new RegExp(escapeRegex(q), 'i')

  const [items, total] = await Promise.all([
    VehicleType.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    VehicleType.countDocuments(filter),
  ])

  res.json({ items, total, page, limit })
}

export async function createVehicleType(req: Request, res: Response) {
  const { name, serviceMode, capacityLabel } = req.body as {
    name?: string
    serviceMode?: 'ride' | 'transport'
    capacityLabel?: string
  }
  if (!name || !serviceMode) {
    res.status(400).json({ message: 'name and serviceMode are required' })
    return
  }

  const vehicleType = await VehicleType.create({ name, serviceMode, capacityLabel })
  await recordAudit(req.admin!, 'vehicle_type.create', 'VehicleType', vehicleType.name)
  res.status(201).json(vehicleType)
}

export async function updateVehicleType(req: Request, res: Response) {
  const vehicleType = await VehicleType.findById(req.params.id)
  if (!vehicleType) {
    res.status(404).json({ message: 'Vehicle type not found' })
    return
  }

  const body = req.body as Partial<{
    name: string
    serviceMode: 'ride' | 'transport'
    capacityLabel: string
    status: 'active' | 'inactive'
  }>

  if (body.name !== undefined) vehicleType.name = body.name
  if (body.serviceMode !== undefined) vehicleType.serviceMode = body.serviceMode
  if (body.capacityLabel !== undefined) vehicleType.capacityLabel = body.capacityLabel
  if (body.status !== undefined) vehicleType.status = body.status
  await vehicleType.save()

  await recordAudit(
    req.admin!,
    body.status ? 'vehicle_type.status_changed' : 'vehicle_type.updated',
    'VehicleType',
    vehicleType.name,
    body.status ? { status: body.status } : undefined,
  )

  res.json(vehicleType)
}
