import { Router } from 'express'
import * as settingsController from '../controllers/settings.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('settings.view'), settingsController.getSettings)
router.patch('/', requirePermission('settings.manage'), settingsController.updateSettings)

export default router
