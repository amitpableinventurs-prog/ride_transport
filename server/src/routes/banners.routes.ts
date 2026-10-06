import { Router } from 'express'
import * as bannersController from '../controllers/banners.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('marketing.view'), bannersController.listBanners)
router.get('/:id', requirePermission('marketing.view'), bannersController.getBanner)
router.post('/', requirePermission('marketing.manage'), bannersController.createBanner)
router.patch('/:id', requirePermission('marketing.manage'), bannersController.updateBanner)
router.delete('/:id', requirePermission('marketing.manage'), bannersController.deleteBanner)

export default router
