import { AuditLog } from '../models/AuditLog'
import type { HydratedDocument } from 'mongoose'
import type { AdminDocument } from '../models/Admin'
import { roleDisplayName } from './roles'

export async function recordAudit(
  actor: HydratedDocument<AdminDocument>,
  action: string,
  targetType: string,
  targetLabel: string,
  metadata?: Record<string, unknown>,
) {
  await AuditLog.create({
    actorId: actor.id,
    actorName: actor.name,
    actorRole: roleDisplayName(actor.role),
    action,
    targetType,
    targetLabel,
    metadata,
  })
}
