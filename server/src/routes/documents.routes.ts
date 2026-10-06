import { Router } from 'express'
import * as documentsController from '../controllers/documents.controller'
import { requireAuth, requirePermission } from '../middleware/auth'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('fleet.view'), documentsController.listDocuments)
router.post('/', requirePermission('fleet.manage'), documentsController.createDocument)
router.patch('/:id', requirePermission('fleet.manage'), documentsController.updateDocumentStatus)

export default router
