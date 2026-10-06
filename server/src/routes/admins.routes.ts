import { Router } from 'express'
import * as adminsController from '../controllers/admins.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('admins.view'), adminsController.listAdmins)
router.post('/', requirePermission('admins.manage'), adminsController.createAdmin)
router.patch('/:id', requirePermission('admins.manage'), adminsController.updateAdmin)

export default router
