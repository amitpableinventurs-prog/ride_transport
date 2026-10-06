import { Router } from 'express'
import * as ratingsController from '../controllers/ratings.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('support.view'), ratingsController.listRatings)

export default router
