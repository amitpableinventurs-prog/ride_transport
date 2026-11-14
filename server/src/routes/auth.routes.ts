import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as authController from '../controllers/auth.controller'
import { requireAuth } from '../middleware/auth'
import { validate } from '../middleware/validate'
import * as schemas from '../validation/schemas'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  // Only failed sign-ins count, so normal use never locks an admin out.
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
})

// Per account, so one email cannot be brute-forced from many IP addresses.
const emailLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => `login:${typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase().slice(0, 254) : 'none'}`,
  message: { message: 'Too many login attempts for this account. Please try again later.' },
})

router.post('/login', loginLimiter, emailLoginLimiter, validate({ body: schemas.adminLoginBody }), authController.login)
router.post('/refresh', validate({ body: schemas.refreshBody }), authController.refresh)
router.post('/logout', requireAuth, authController.logout)
router.get('/me', requireAuth, authController.me)

export default router
