import { Router } from 'express'
import * as commissionsController from '../controllers/commissions.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('finance.view'), commissionsController.listCommissionRules)
router.post('/', requirePermission('finance.manage'), commissionsController.createCommissionRule)
router.patch('/:id', requirePermission('finance.manage'), commissionsController.updateCommissionRule)
router.delete('/:id', requirePermission('finance.manage'), commissionsController.deactivateCommissionRule)

export default router
