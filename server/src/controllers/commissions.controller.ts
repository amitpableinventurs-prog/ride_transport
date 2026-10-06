import type { Request, Response } from 'express'
import { CommissionRule } from '../models/CommissionRule'
import { recordAudit } from '../utils/audit'

export async function listCommissionRules(req: Request, res: Response) {
  const { appliesTo, categoryKey, status } = req.query as { appliesTo?: string; categoryKey?: string; status?: string }
  const filter: Record<string, unknown> = {}
  if (appliesTo) filter.appliesTo = appliesTo
  if (categoryKey) filter.categoryKey = categoryKey
  if (status) filter.status = status

  const rules = await CommissionRule.find(filter).sort({ appliesTo: 1, createdAt: -1 })
  res.json(rules)
}

export async function createCommissionRule(req: Request, res: Response) {
  const body = req.body as { appliesTo?: string; type?: string; value?: number }
  if (!body.appliesTo || !body.type || body.value === undefined) {
    res.status(400).json({ message: 'appliesTo, type and value are required' })
    return
  }

  const rule = await CommissionRule.create(req.body)
  const label = `${rule.appliesTo}${rule.categoryKey ? `:${rule.categoryKey}` : ''}`
  await recordAudit(req.admin!, 'commission_rule.created', 'CommissionRule', label)
  res.status(201).json(rule)
}

export async function updateCommissionRule(req: Request, res: Response) {
  const rule = await CommissionRule.findById(req.params.id)
  if (!rule) {
    res.status(404).json({ message: 'Commission rule not found' })
    return
  }

  const body = req.body as Record<string, unknown>
  const allowedKeys = ['appliesTo', 'categoryKey', 'type', 'value', 'effectiveFrom', 'status'] as const
  const mutableRule = rule as unknown as Record<string, unknown>
  for (const key of allowedKeys) {
    if (body[key] !== undefined) mutableRule[key] = body[key]
  }
  await rule.save()

  const label = `${rule.appliesTo}${rule.categoryKey ? `:${rule.categoryKey}` : ''}`
  await recordAudit(req.admin!, 'commission_rule.updated', 'CommissionRule', label, body)
  res.json(rule)
}

export async function deactivateCommissionRule(req: Request, res: Response) {
  const rule = await CommissionRule.findById(req.params.id)
  if (!rule) {
    res.status(404).json({ message: 'Commission rule not found' })
    return
  }

  rule.status = 'inactive'
  await rule.save()
  const label = `${rule.appliesTo}${rule.categoryKey ? `:${rule.categoryKey}` : ''}`
  await recordAudit(req.admin!, 'commission_rule.deactivated', 'CommissionRule', label)
  res.json(rule)
}
