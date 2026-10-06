import type { Request, Response } from 'express'
import { Types } from 'mongoose'
import { Vehicle } from '../models/Vehicle'
import { Driver } from '../models/Driver'
import { TransportPartner } from '../models/TransportPartner'
import { recordAudit } from '../utils/audit'

function parsePagination(req: Request) {
  const page = Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? '20'), 10) || 20))
  return { page, limit, skip: (page - 1) * limit }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function ownerLabelFor(ownerModel: string, ownerId: Types.ObjectId): Promise<string> {
  if (ownerModel === 'Driver') {
    const driver = await Driver.findById(ownerId).select('name')
    return driver?.name ?? 'Unknown driver'
  }
  const partner = await TransportPartner.findById(ownerId).select('companyName')
  return partner?.companyName ?? 'Unknown partner'
}

export async function listVehicles(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req)
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  const status = typeof req.query.status === 'string' ? req.query.status : undefined
  const serviceMode = typeof req.query.serviceMode === 'string' ? req.query.serviceMode : undefined
  const ownerType = typeof req.query.ownerType === 'string' ? req.query.ownerType : undefined

  const filter: Record<string, unknown> = {}
  if (status) filter.status = status
  if (serviceMode) filter.serviceMode = serviceMode
  if (ownerType) filter.ownerType = ownerType
  if (q) {
    const re = new RegExp(escapeRegex(q), 'i')
    filter.$or = [{ registrationNumber: re }, { model: re }, { manufacturer: re }]
  }

  const [vehicles, total] = await Promise.all([
    Vehicle.find(filter).populate('vehicleType', 'name serviceMode capacityLabel').sort({ createdAt: -1 }).skip(skip).limit(limit),
    Vehicle.countDocuments(filter),
  ])

  const items = await Promise.all(
    vehicles.map(async (vehicle) => {
      const ownerLabel = await ownerLabelFor(vehicle.ownerModel, vehicle.ownerId)
      return { ...vehicle.toJSON(), ownerLabel }
    }),
  )

  res.json({ items, total, page, limit })
}

export async function createVehicle(req: Request, res: Response) {
  const body = req.body as {
    registrationNumber?: string
    model?: string
    manufacturer?: string
    vehicleType?: string
    serviceMode?: 'ride' | 'transport'
    categoryKey?: string
    ownerType?: 'driver' | 'partner'
    ownerId?: string
    capacity?: string
  }

  const { registrationNumber, model, vehicleType, serviceMode, categoryKey, ownerType, ownerId } = body
  if (!registrationNumber || !model || !vehicleType || !serviceMode || !categoryKey || !ownerType || !ownerId) {
    res.status(400).json({
      message: 'registrationNumber, model, vehicleType, serviceMode, categoryKey, ownerType and ownerId are required',
    })
    return
  }

  const normalizedReg = registrationNumber.trim().toUpperCase()
  const existing = await Vehicle.findOne({ registrationNumber: normalizedReg })
  if (existing) {
    res.status(409).json({ message: 'A vehicle with this registration number already exists' })
    return
  }

  const ownerModel = ownerType === 'driver' ? 'Driver' : 'TransportPartner'

  const vehicle = await Vehicle.create({
    registrationNumber: normalizedReg,
    model,
    manufacturer: body.manufacturer,
    vehicleType: new Types.ObjectId(vehicleType),
    serviceMode,
    categoryKey,
    ownerType,
    ownerId: new Types.ObjectId(ownerId),
    ownerModel,
    capacity: body.capacity,
  })

  await recordAudit(req.admin!, 'vehicle.create', 'Vehicle', vehicle.registrationNumber)

  res.status(201).json(vehicle)
}

export async function updateVehicle(req: Request, res: Response) {
  const vehicle = await Vehicle.findById(req.params.id)
  if (!vehicle) {
    res.status(404).json({ message: 'Vehicle not found' })
    return
  }

  const body = req.body as Partial<{
    model: string
    manufacturer: string
    vehicleType: string
    capacity: string
    status: 'active' | 'inactive' | 'blocked'
    documentsStatus: 'pending' | 'verified' | 'rejected' | 'expired'
  }>

  // `model` collides with Mongoose's Document#model() method name, so the
  // schema path must be set via .set() rather than direct property assignment.
  if (body.model !== undefined) vehicle.set('model', body.model)
  if (body.manufacturer !== undefined) vehicle.manufacturer = body.manufacturer
  if (body.vehicleType !== undefined) vehicle.vehicleType = new Types.ObjectId(body.vehicleType)
  if (body.capacity !== undefined) vehicle.capacity = body.capacity
  if (body.status !== undefined) vehicle.status = body.status
  if (body.documentsStatus !== undefined) vehicle.documentsStatus = body.documentsStatus
  await vehicle.save()

  await recordAudit(
    req.admin!,
    body.status ? 'vehicle.status_changed' : 'vehicle.updated',
    'Vehicle',
    vehicle.registrationNumber,
    body.status ? { status: body.status } : undefined,
  )

  res.json(vehicle)
}
