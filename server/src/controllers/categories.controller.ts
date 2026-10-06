import type { Request, Response } from 'express'
import type { FilterQuery } from 'mongoose'
import { ServiceCategory, type ServiceCategoryDocument } from '../models/ServiceCategory'
import { recordAudit } from '../utils/audit'

export async function listCategories(req: Request, res: Response) {
  const { mode } = req.query as { mode?: string }
  const filter: FilterQuery<ServiceCategoryDocument> = {}
  if (mode) filter.mode = mode as ServiceCategoryDocument['mode']

  const categories = await ServiceCategory.find(filter).sort({ sortOrder: 1, name: 1 }).populate('vehicleType', 'name capacityLabel')
  res.json(categories)
}

export async function createCategory(req: Request, res: Response) {
  const { mode, key, name, description, icon, seats, capacityLabel, vehicleType, status, sortOrder } = req.body as {
    mode?: 'ride' | 'transport'
    key?: string
    name?: string
    description?: string
    icon?: string
    seats?: number
    capacityLabel?: string
    vehicleType?: string
    status?: 'active' | 'inactive'
    sortOrder?: number
  }

  if (!mode || !key || !name) {
    res.status(400).json({ message: 'mode, key and name are required' })
    return
  }

  const existing = await ServiceCategory.findOne({ key: key.trim() })
  if (existing) {
    res.status(409).json({ message: 'A category with this key already exists' })
    return
  }

  const category = await ServiceCategory.create({
    mode,
    key: key.trim(),
    name,
    description,
    icon,
    seats,
    capacityLabel,
    vehicleType: vehicleType || null,
    status,
    sortOrder,
  })

  await recordAudit(req.admin!, 'category.created', 'ServiceCategory', `${category.name} (${category.key})`)
  res.status(201).json(category)
}

export async function updateCategory(req: Request, res: Response) {
  const category = await ServiceCategory.findById(req.params.id)
  if (!category) {
    res.status(404).json({ message: 'Category not found' })
    return
  }

  const body = req.body as Partial<{
    name: string
    description: string
    icon: string
    seats: number
    capacityLabel: string
    vehicleType: string | null
    status: 'active' | 'inactive'
    sortOrder: number
  }>

  if (body.name !== undefined) category.name = body.name
  if (body.description !== undefined) category.description = body.description
  if (body.icon !== undefined) category.icon = body.icon
  if (body.seats !== undefined) category.seats = body.seats
  if (body.capacityLabel !== undefined) category.capacityLabel = body.capacityLabel
  if (body.vehicleType !== undefined) category.vehicleType = body.vehicleType as never
  if (body.status !== undefined) category.status = body.status
  if (body.sortOrder !== undefined) category.sortOrder = body.sortOrder

  await category.save()

  await recordAudit(req.admin!, 'category.updated', 'ServiceCategory', `${category.name} (${category.key})`)
  res.json(category)
}

export async function deleteCategory(req: Request, res: Response) {
  const category = await ServiceCategory.findById(req.params.id)
  if (!category) {
    res.status(404).json({ message: 'Category not found' })
    return
  }

  await category.deleteOne()

  await recordAudit(req.admin!, 'category.deleted', 'ServiceCategory', `${category.name} (${category.key})`)
  res.status(204).send()
}
