import { Router } from 'express'
import * as settlementsController from '../controllers/settlements.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('finance.view'), settlementsController.listSettlements)
router.patch('/:id/mark-paid', requirePermission('finance.manage'), settlementsController.markSettlementPaid)

export default router
