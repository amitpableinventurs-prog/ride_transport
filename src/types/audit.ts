export interface AuditLogEntry {
  id: string
  actorId: string
  actorName: string
  actorRole: string
  action: string
  targetType: string
  targetLabel: string
  metadata?: Record<string, string | number | boolean>
  createdAt: string
}
