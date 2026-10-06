import { Router } from 'express'
import * as serviceAreasController from '../controllers/serviceAreas.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('settings.view'), serviceAreasController.listServiceAreas)
router.get('/:id', requirePermission('settings.view'), serviceAreasController.getServiceArea)
router.post('/', requirePermission('settings.manage'), serviceAreasController.createServiceArea)
router.patch('/:id', requirePermission('settings.manage'), serviceAreasController.updateServiceArea)
router.delete('/:id', requirePermission('settings.manage'), serviceAreasController.deleteServiceArea)

export default router
