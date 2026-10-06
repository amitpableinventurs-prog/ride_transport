import type { Request, Response } from 'express'
import { PricingRule } from '../models/PricingRule'
import { recordAudit } from '../utils/audit'

export async function listPricingRules(req: Request, res: Response) {
  const { mode, categoryKey, status } = req.query as { mode?: string; categoryKey?: string; status?: string }
  const filter: Record<string, unknown> = {}
  if (mode) filter.mode = mode
  if (categoryKey) filter.categoryKey = categoryKey
  if (status) filter.status = status

  const rules = await PricingRule.find(filter).sort({ mode: 1, categoryKey: 1, createdAt: -1 })
  res.json(rules)
}

export async function createPricingRule(req: Request, res: Response) {
  const body = req.body as {
    mode?: string
    categoryKey?: string
    baseFare?: number
    perKm?: number
    minimumFare?: number
  }

  if (!body.mode || !body.categoryKey || body.baseFare === undefined || body.perKm === undefined || body.minimumFare === undefined) {
    res.status(400).json({ message: 'mode, categoryKey, baseFare, perKm and minimumFare are required' })
    return
  }

  const rule = await PricingRule.create(req.body)
  await recordAudit(req.admin!, 'pricing_rule.created', 'PricingRule', `${rule.mode}:${rule.categoryKey}`)
  res.status(201).json(rule)
}

export async function updatePricingRule(req: Request, res: Response) {
  const rule = await PricingRule.findById(req.params.id)
  if (!rule) {
    res.status(404).json({ message: 'Pricing rule not found' })
    return
  }

  const body = req.body as Record<string, unknown>
  const allowedKeys = [
    'mode',
    'categoryKey',
    'serviceArea',
    'baseFare',
    'perKm',
    'perMinute',
    'minimumFare',
    'waitingChargePerMin',
    'nightChargeMultiplier',
    'platformFeeFlat',
    'platformFeePercent',
    'cancellationFee',
    'loadingUnloadingCharge',
    'additionalStopCharge',
    'taxPercent',
    'effectiveFrom',
    'status',
  ] as const

  const mutableRule = rule as unknown as Record<string, unknown>
  for (const key of allowedKeys) {
    if (body[key] !== undefined) mutableRule[key] = body[key]
  }
  await rule.save()

  await recordAudit(req.admin!, 'pricing_rule.updated', 'PricingRule', `${rule.mode}:${rule.categoryKey}`, body)
  res.json(rule)
}

export async function deactivatePricingRule(req: Request, res: Response) {
  const rule = await PricingRule.findById(req.params.id)
  if (!rule) {
    res.status(404).json({ message: 'Pricing rule not found' })
    return
  }

  rule.status = 'inactive'
  await rule.save()
  await recordAudit(req.admin!, 'pricing_rule.deactivated', 'PricingRule', `${rule.mode}:${rule.categoryKey}`)
  res.json(rule)
}
