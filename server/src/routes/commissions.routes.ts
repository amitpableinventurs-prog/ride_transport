import { Router } from 'express'
import * as commissionsController from '../controllers/commissions.controller'
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
router.get('/', requirePermission('finance.view'), commissionsController.listCommissionRules)
router.post('/', requirePermission('finance.manage'), validate({ body: schemas.createCommissionBody }), commissionsController.createCommissionRule)
router.patch('/:id', requirePermission('finance.manage'), validate({ params: schemas.idParams, body: schemas.updateCommissionBody }), commissionsController.updateCommissionRule)
router.delete('/:id', requirePermission('finance.manage'), commissionsController.deactivateCommissionRule)

export default router
