import { Router } from 'express'
import * as reportsController from '../controllers/reports.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.use(requirePermission('reports.view'))

router.get('/booking', reportsController.getBookingReport)
router.get('/revenue', reportsController.getRevenueReport)
router.get('/rider', reportsController.getRiderReport)
router.get('/partner', reportsController.getPartnerReport)
router.get('/financial', reportsController.getFinancialReport)

export default router
