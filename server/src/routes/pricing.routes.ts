import { Router } from 'express'
import * as pricingController from '../controllers/pricing.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('pricing.view'), pricingController.listPricingRules)
router.post('/', requirePermission('pricing.manage'), pricingController.createPricingRule)
router.patch('/:id', requirePermission('pricing.manage'), pricingController.updatePricingRule)
router.delete('/:id', requirePermission('pricing.manage'), pricingController.deactivatePricingRule)

export default router
