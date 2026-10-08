import { Router } from 'express'
import * as driversController from '../controllers/drivers.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('users.view'), driversController.listDrivers)
router.patch('/:id', requirePermission('users.manage'), driversController.updateDriver)
router.delete('/:id', requirePermission('users.manage'), driversController.deleteDriver)

export default router
