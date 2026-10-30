import { Router } from 'express'
import * as errorLogsController from '../controllers/errorLogs.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('error_logs.view'), errorLogsController.listErrorLogs)
router.get('/summary', requirePermission('error_logs.view'), errorLogsController.errorLogSummary)
router.get('/:id', requirePermission('error_logs.view'), errorLogsController.getErrorLog)
router.patch('/:id', requirePermission('error_logs.manage'), errorLogsController.updateErrorLog)
router.post('/:id/resolve-similar', requirePermission('error_logs.manage'), errorLogsController.resolveSimilarErrorLogs)

export default router
