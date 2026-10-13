import { Router } from 'express'
import * as withdrawalsController from '../controllers/withdrawals.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('finance.view'), withdrawalsController.listWithdrawals)
router.patch('/:id/processing', requirePermission('finance.manage'), withdrawalsController.markWithdrawalProcessing)
router.patch('/:id/paid', requirePermission('finance.manage'), withdrawalsController.markWithdrawalPaid)
router.patch('/:id/reject', requirePermission('finance.manage'), withdrawalsController.rejectWithdrawal)

export default router
