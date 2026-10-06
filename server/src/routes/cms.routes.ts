import { Router } from 'express'
import * as cmsController from '../controllers/cms.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('marketing.view'), cmsController.listCmsPages)
router.get('/:slug', requirePermission('marketing.view'), cmsController.getCmsPage)
router.patch('/:slug', requirePermission('marketing.manage'), cmsController.updateCmsPage)

export default router
