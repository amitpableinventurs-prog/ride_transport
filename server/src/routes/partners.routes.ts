import { Router } from 'express'
import * as partnersController from '../controllers/partners.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('users.view'), partnersController.listPartners)
router.patch('/:id', requirePermission('users.manage'), partnersController.updatePartner)

export default router
