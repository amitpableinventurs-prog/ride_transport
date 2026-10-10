import type { Request, Response } from 'express'
import { NotificationTemplate } from '../models/NotificationTemplate'
import { NotificationBroadcast } from '../models/NotificationBroadcast'
import { Customer } from '../models/Customer'
import { Device } from '../models/Device'
import { Driver } from '../models/Driver'
import { recordAudit } from '../utils/audit'
import { pushToTokens } from '../utils/notify'

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

// Push broadcasts that reach real devices; other audiences / channels are recorded with an estimate.
const PUSH_AUDIENCE_USER_TYPE = { all_customers: 'customer', all_drivers: 'driver' } as const

/** Device tokens a push broadcast goes to; null when the audience is not sent as push. */
async function broadcastTokens(audience: string, serviceModeFilter: string): Promise<{ userType: 'customer' | 'driver'; tokens: string[] } | null> {
  const userType = PUSH_AUDIENCE_USER_TYPE[audience as keyof typeof PUSH_AUDIENCE_USER_TYPE]
  if (!userType) return null
  const filter: Record<string, unknown> = { userType }
  // Riders can be limited to ride or delivery (transport) riders.
  if (userType === 'driver' && (serviceModeFilter === 'ride' || serviceModeFilter === 'transport')) {
    filter.userId = { $in: await Driver.find({ serviceType: serviceModeFilter === 'ride' ? 'rider' : 'transport' }).distinct('_id') }
  }
  // Customers can switch off offer notifications in Settings.
  if (userType === 'customer') filter.userId = { $nin: await Customer.find({ 'notificationPrefs.offers': false }).distinct('_id') }
  return { userType, tokens: await Device.find(filter).distinct('token') }
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

  const serviceModeFilter = body.serviceModeFilter ?? 'both'
  const push = body.channel === 'push' ? await broadcastTokens(body.audience, serviceModeFilter) : null
  const base = AUDIENCE_BASE_ESTIMATE[body.audience] ?? 500
  const recipientCountEstimate = push ? push.tokens.length : base + Math.floor(Math.random() * base * 0.5)

  const broadcast = await NotificationBroadcast.create({
    template: body.templateId || null,
    channel: body.channel,
    audience: body.audience,
    serviceModeFilter,
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

  // Sent after answering: a large audience takes a while, and the apps also show it in their notification list.
  if (push?.tokens.length) {
    const message = { title: broadcast.title, body: broadcast.body, data: { type: 'announcement', broadcastId: broadcast.id as string } }
    void pushToTokens(push.userType, push.tokens, message).catch((err) => console.error('[broadcast] push failed', err))
  }

  const populated = await broadcast.populate('template', 'key channel')
  res.status(201).json(populated)
}
