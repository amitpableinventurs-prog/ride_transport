import type { Request, Response } from 'express'
import { NotificationTemplate } from '../models/NotificationTemplate'
import { NotificationBroadcast } from '../models/NotificationBroadcast'
import { recordAudit } from '../utils/audit'

const TEMPLATE_FIELDS = ['key', 'channel', 'title', 'body', 'status'] as const

function pickTemplateFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {}
  for (const key of TEMPLATE_FIELDS) {
    if (body[key] !== undefined) out[key] = body[key]
  }
  return out
}

export async function listTemplates(_req: Request, res: Response) {
  const templates = await NotificationTemplate.find().sort({ createdAt: -1 })
  res.json(templates)
}

export async function createTemplate(req: Request, res: Response) {
  const body = req.body as Record<string, unknown>
  if (!body.key || !body.channel || !body.body) {
    res.status(400).json({ message: 'key, channel and body are required' })
    return
  }

  const template = await NotificationTemplate.create(pickTemplateFields(body))
  await recordAudit(req.admin!, 'notification_template.create', 'NotificationTemplate', template.key)
  res.status(201).json(template)
}

export async function updateTemplate(req: Request, res: Response) {
  const template = await NotificationTemplate.findById(req.params.id)
  if (!template) {
    res.status(404).json({ message: 'Notification template not found' })
    return
  }

  Object.assign(template, pickTemplateFields(req.body as Record<string, unknown>))
  await template.save()

  await recordAudit(req.admin!, 'notification_template.updated', 'NotificationTemplate', template.key)
  res.json(template)
}

const AUDIENCE_BASE_ESTIMATE: Record<string, number> = {
  all_customers: 8000,
  all_drivers: 1200,
  all_partners: 150,
  custom: 300,
}

export async function listBroadcasts(_req: Request, res: Response) {
  const broadcasts = await NotificationBroadcast.find().populate('template', 'key channel').sort({ createdAt: -1 })
  res.json(broadcasts)
}

export async function createBroadcast(req: Request, res: Response) {
  const body = req.body as {
    templateId?: string | null
    channel?: string
    audience?: string
    serviceModeFilter?: string
    title?: string
    body?: string
  }

  if (!body.channel || !body.audience || !body.title || !body.body) {
    res.status(400).json({ message: 'channel, audience, title and body are required' })
    return
  }

  const base = AUDIENCE_BASE_ESTIMATE[body.audience] ?? 500
  const recipientCountEstimate = base + Math.floor(Math.random() * base * 0.5)

  const broadcast = await NotificationBroadcast.create({
    template: body.templateId || null,
    channel: body.channel,
    audience: body.audience,
    serviceModeFilter: body.serviceModeFilter ?? 'both',
    title: body.title,
    body: body.body,
    sentBy: req.admin!.id,
    recipientCountEstimate,
  })

  await recordAudit(req.admin!, 'notification.broadcast_sent', 'NotificationBroadcast', broadcast.title, {
    audience: broadcast.audience,
    channel: broadcast.channel,
    recipientCountEstimate,
  })

  const populated = await broadcast.populate('template', 'key channel')
  res.status(201).json(populated)
}
