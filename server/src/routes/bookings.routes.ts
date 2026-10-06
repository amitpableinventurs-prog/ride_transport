import { Router } from 'express'
import * as bookingsController from '../controllers/bookings.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/available-drivers', requirePermission('bookings.view'), bookingsController.listAvailableDrivers)
router.get('/', requirePermission('bookings.view'), bookingsController.listBookings)
router.get('/:id', requirePermission('bookings.view'), bookingsController.getBooking)
router.patch('/:id/assign', requirePermission('bookings.manage'), bookingsController.assignBooking)
router.patch('/:id/status', requirePermission('bookings.manage'), bookingsController.updateBookingStatus)

export default router
