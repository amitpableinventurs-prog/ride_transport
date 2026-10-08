import { Router } from 'express'
import * as customersController from '../controllers/customers.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('users.view'), customersController.listCustomers)
router.patch('/:id', requirePermission('users.manage'), customersController.updateCustomer)

export default router
