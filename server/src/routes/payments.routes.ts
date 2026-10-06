import { Router } from 'express'
import * as paymentsController from '../controllers/payments.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('finance.view'), paymentsController.listPayments)

export default router
