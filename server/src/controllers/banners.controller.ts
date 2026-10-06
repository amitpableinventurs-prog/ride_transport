import type { Request, Response } from 'express'
import type { FilterQuery } from 'mongoose'
import { Banner, type BannerDocument } from '../models/Banner'
import { recordAudit } from '../utils/audit'

const MUTABLE_FIELDS = ['title', 'description', 'imageUrl', 'ctaLabel', 'targetLink', 'serviceMode', 'startDate', 'endDate', 'status'] as const

function pickMutableFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const key of MUTABLE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key]
  }
  return out
}

export async function listBanners(req: Request, res: Response) {
  const { status, serviceMode } = req.query as { status?: string; serviceMode?: string }
  const filter: FilterQuery<BannerDocument> = {}
  if (status) filter.status = status as BannerDocument['status']
  if (serviceMode) filter.serviceMode = serviceMode as BannerDocument['serviceMode']
  const banners = await Banner.find(filter).sort({ createdAt: -1 })
  res.json(banners)
}

export async function getBanner(req: Request, res: Response) {
  const banner = await Banner.findById(req.params.id)
  if (!banner) {
    res.status(404).json({ message: 'Banner not found' })
    return
  }
  res.json(banner)
}

export async function createBanner(req: Request, res: Response) {
  const body = req.body as Record<string, unknown>
  if (!body.title || !body.imageUrl || !body.startDate || !body.endDate) {
    res.status(400).json({ message: 'title, imageUrl, startDate and endDate are required' })
    return
  }

  const banner = await Banner.create(pickMutableFields(body))
  await recordAudit(req.admin!, 'banner.create', 'Banner', banner.title)
  res.status(201).json(banner)
}

export async function updateBanner(req: Request, res: Response) {
  const banner = await Banner.findById(req.params.id)
  if (!banner) {
    res.status(404).json({ message: 'Banner not found' })
    return
  }

  const patch = pickMutableFields(req.body as Record<string, unknown>)
  Object.assign(banner, patch)
  await banner.save()

  await recordAudit(req.admin!, 'banner.updated', 'Banner', banner.title, patch.status !== undefined ? { status: patch.status } : undefined)
  res.json(banner)
}

export async function deleteBanner(req: Request, res: Response) {
  const banner = await Banner.findById(req.params.id)
  if (!banner) {
    res.status(404).json({ message: 'Banner not found' })
    return
  }
  await banner.deleteOne()
  await recordAudit(req.admin!, 'banner.deleted', 'Banner', banner.title)
  res.status(204).end()
}
