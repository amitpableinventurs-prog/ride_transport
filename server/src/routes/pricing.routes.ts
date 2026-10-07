import { Router } from 'express'
import * as pricingController from '../controllers/pricing.controller'
import { requireAuth, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import * as schemas from '../validation/schemas'
import { clearFareCaches } from '../utils/fare'

const router = Router()

router.use(requireAuth)
// Any change by an admin takes effect at once instead of after the cache expires.
router.use((req, res, next) => {
  if (req.method !== 'GET') res.on('finish', clearFareCaches)
  next()
})
router.get('/', requirePermission('pricing.view'), pricingController.listPricingRules)
router.post('/', requirePermission('pricing.manage'), validate({ body: schemas.createPricingBody }), pricingController.createPricingRule)
router.patch('/:id', requirePermission('pricing.manage'), validate({ params: schemas.idParams, body: schemas.updatePricingBody }), pricingController.updatePricingRule)
router.delete('/:id', requirePermission('pricing.manage'), pricingController.deactivatePricingRule)

export default router
