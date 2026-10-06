import { Router } from 'express'
import * as categoriesController from '../controllers/categories.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('bookings.view'), categoriesController.listCategories)
router.post('/', requirePermission('bookings.manage'), categoriesController.createCategory)
router.patch('/:id', requirePermission('bookings.manage'), categoriesController.updateCategory)
router.delete('/:id', requirePermission('bookings.manage'), categoriesController.deleteCategory)

export default router
