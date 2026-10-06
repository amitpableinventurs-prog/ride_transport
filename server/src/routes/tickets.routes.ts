import { Router } from 'express'
import * as ticketsController from '../controllers/tickets.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('support.view'), ticketsController.listTickets)
router.get('/:id', requirePermission('support.view'), ticketsController.getTicket)
router.patch('/:id', requirePermission('support.manage'), ticketsController.updateTicket)

export default router
