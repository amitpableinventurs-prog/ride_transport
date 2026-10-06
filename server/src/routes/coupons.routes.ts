import { Router } from 'express'
import * as couponsController from '../controllers/coupons.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('marketing.view'), couponsController.listCoupons)
router.get('/:id', requirePermission('marketing.view'), couponsController.getCoupon)
router.post('/', requirePermission('marketing.manage'), couponsController.createCoupon)
router.patch('/:id', requirePermission('marketing.manage'), couponsController.updateCoupon)
router.delete('/:id', requirePermission('marketing.manage'), couponsController.deleteCoupon)

export default router
