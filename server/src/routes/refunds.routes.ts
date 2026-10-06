import { Router } from 'express'
import * as refundsController from '../controllers/refunds.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('finance.view'), refundsController.listRefunds)
router.patch('/:id/approve', requirePermission('finance.manage'), refundsController.approveRefund)
router.patch('/:id/reject', requirePermission('finance.manage'), refundsController.rejectRefund)
router.patch('/:id/process', requirePermission('finance.manage'), refundsController.processRefund)

export default router
