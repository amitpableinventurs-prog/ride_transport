import { Router } from 'express'
import * as common from '../../controllers/common/common.controller'
import { requireAppAuth } from '../../middleware/appAuth'

// SRS §10.5 common APIs, mounted at /api/v1/common.
export const commonRouter = Router()
commonRouter.get('/app-config', common.getAppConfig)
commonRouter.get('/cms/:slug', common.getCmsPage)
commonRouter.post('/devices', requireAppAuth, common.registerDevice)

// Pages opened from shared links without logging in, mounted at /api/v1/public.
export const publicRouter = Router()
publicRouter.get('/track/:token', common.publicTrack)
publicRouter.get('/invoices/:token', common.publicInvoice)

// Terms and privacy as web pages at the site root (/terms, /privacy, /rider-terms).
export const legalPagesRouter = Router()
legalPagesRouter.get(Object.keys(common.LEGAL_PAGE_PATHS), common.legalPage)
