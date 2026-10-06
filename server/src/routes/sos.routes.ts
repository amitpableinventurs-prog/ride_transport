import { Router } from 'express'
import * as sosController from '../controllers/sos.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('bookings.view'), sosController.listSosRequests)
router.patch('/:id', requirePermission('bookings.manage'), sosController.updateSosRequest)

export default router
