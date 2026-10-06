import { Router } from 'express'
import * as auditLogsController from '../controllers/auditLogs.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('audit_logs.view'), auditLogsController.listAuditLogs)

export default router
