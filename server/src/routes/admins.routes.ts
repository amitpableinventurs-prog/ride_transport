import { Router } from 'express'
import * as adminsController from '../controllers/admins.controller'
import { requireAuth, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import * as schemas from '../validation/schemas'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('admins.view'), adminsController.listAdmins)
router.post('/', requirePermission('admins.manage'), validate({ body: schemas.createAdminBody }), adminsController.createAdmin)
router.patch('/:id', requirePermission('admins.manage'), validate({ params: schemas.idParams, body: schemas.updateAdminBody }), adminsController.updateAdmin)

export default router
