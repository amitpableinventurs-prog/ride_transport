import { Router } from 'express'
import * as rolesController from '../controllers/roles.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('roles.view'), rolesController.listRoles)
router.patch('/:key', requirePermission('roles.manage'), rolesController.updateRolePermissions)

export default router
