import { Router } from 'express'
import authRoutes from './auth.routes'
import dashboardRoutes from './dashboard.routes'
import adminsRoutes from './admins.routes'
import rolesRoutes from './roles.routes'
import auditLogsRoutes from './auditLogs.routes'
import settingsRoutes from './settings.routes'
import customersRoutes from './customers.routes'
import driversRoutes from './drivers.routes'
import partnersRoutes from './partners.routes'
import bookingsRoutes from './bookings.routes'
import categoriesRoutes from './categories.routes'
import sosRoutes from './sos.routes'
import vehiclesRoutes from './vehicles.routes'
import vehicleTypesRoutes from './vehicleTypes.routes'
import documentsRoutes from './documents.routes'
import pricingRoutes from './pricing.routes'
import commissionsRoutes from './commissions.routes'
import paymentsRoutes from './payments.routes'
import refundsRoutes from './refunds.routes'
import walletsRoutes from './wallets.routes'
import settlementsRoutes from './settlements.routes'
import couponsRoutes from './coupons.routes'
import bannersRoutes from './banners.routes'
import notificationsRoutes from './notifications.routes'
import cmsRoutes from './cms.routes'
import serviceAreasRoutes from './serviceAreas.routes'
import ticketsRoutes from './tickets.routes'
import ratingsRoutes from './ratings.routes'
import reportsRoutes from './reports.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/dashboard', dashboardRoutes)
router.use('/admins', adminsRoutes)
router.use('/roles', rolesRoutes)
router.use('/audit-logs', auditLogsRoutes)
router.use('/settings', settingsRoutes)
router.use('/users/customers', customersRoutes)
router.use('/users/drivers', driversRoutes)
router.use('/users/partners', partnersRoutes)
router.use('/bookings', bookingsRoutes)
router.use('/service-categories', categoriesRoutes)
router.use('/sos', sosRoutes)
router.use('/fleet/vehicles', vehiclesRoutes)
router.use('/fleet/vehicle-types', vehicleTypesRoutes)
router.use('/fleet/documents', documentsRoutes)
router.use('/pricing', pricingRoutes)
router.use('/commissions', commissionsRoutes)
router.use('/payments', paymentsRoutes)
router.use('/refunds', refundsRoutes)
router.use('/wallets', walletsRoutes)
router.use('/settlements', settlementsRoutes)
router.use('/coupons', couponsRoutes)
router.use('/banners', bannersRoutes)
router.use('/notifications', notificationsRoutes)
router.use('/cms', cmsRoutes)
router.use('/service-areas', serviceAreasRoutes)
router.use('/tickets', ticketsRoutes)
router.use('/ratings', ratingsRoutes)
router.use('/reports', reportsRoutes)

export default router
