import { Router } from 'express'
import * as notificationsController from '../controllers/notifications.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/templates', requirePermission('marketing.view'), notificationsController.listTemplates)
router.post('/templates', requirePermission('marketing.manage'), notificationsController.createTemplate)
router.patch('/templates/:id', requirePermission('marketing.manage'), notificationsController.updateTemplate)

router.get('/broadcasts', requirePermission('marketing.view'), notificationsController.listBroadcasts)
router.post('/broadcasts', requirePermission('marketing.manage'), notificationsController.createBroadcast)

export default router
