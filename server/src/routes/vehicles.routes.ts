import { Router } from 'express'
import * as vehiclesController from '../controllers/vehicles.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('fleet.view'), vehiclesController.listVehicles)
router.post('/', requirePermission('fleet.manage'), vehiclesController.createVehicle)
router.patch('/:id', requirePermission('fleet.manage'), vehiclesController.updateVehicle)

export default router
