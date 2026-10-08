import { Router } from 'express'
import * as vehicleTypesController from '../controllers/vehicleTypes.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('fleet.view'), vehicleTypesController.listVehicleTypes)
router.post('/', requirePermission('fleet.manage'), vehicleTypesController.createVehicleType)
router.patch('/:id', requirePermission('fleet.manage'), vehicleTypesController.updateVehicleType)
router.delete('/:id', requirePermission('fleet.manage'), vehicleTypesController.deleteVehicleType)

export default router
