import { Router } from 'express'
import * as walletsController from '../controllers/wallets.controller'
import { requireAuth, requirePermission } from '../middleware/auth'
import { validate } from '../middleware/validate'
import * as schemas from '../validation/schemas'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('finance.view'), walletsController.listWallets)
router.get('/:id/transactions', requirePermission('finance.view'), walletsController.getWalletTransactions)
router.post('/:id/adjust', requirePermission('finance.manage'), validate({ params: schemas.idParams, body: schemas.adjustWalletBody }), walletsController.adjustWallet)

export default router
