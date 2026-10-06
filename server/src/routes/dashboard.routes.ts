import { Router } from 'express'
import * as dashboardController from '../controllers/dashboard.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/stats', requirePermission('dashboard.view'), dashboardController.getDashboardStats)

export default router
