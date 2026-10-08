import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import swaggerUi from 'swagger-ui-express'
import { env } from './config/env'
import adminRoutes from './routes'
import appRoutes from './routes/app'
import customerRoutes from './routes/app/customer.routes'
import riderRoutes from './routes/app/rider.routes'
import { commonRouter, publicRouter } from './routes/app/common.routes'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { apiLimiter, noStore, sanitizeRequest } from './middleware/security'
import { overloadGuard, overloadStats, requestTimeout } from './middleware/overload'
import { openApiSpec } from './docs/openapi'
import mongoose from 'mongoose'

export const app = express()
app.disable('x-powered-by')
if (env.trustProxy > 0) app.set('trust proxy', env.trustProxy)
// First in line: turn requests away cheaply when overloaded and never let one hang forever.
app.use(overloadGuard, requestTimeout)

// Swagger UI is served over plain http locally, so skip helmet's upgrade-insecure-requests there.
const defaultHelmet = helmet()
const docsHelmet = helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } })
app.use((req, res, next) => (req.path === '/api-docs' || req.path.startsWith('/api-docs/') ? docsHelmet : defaultHelmet)(req, res, next))
app.use(cors({ origin: env.corsOrigin }))
app.use(express.json({ limit: '100kb' }))
if (env.logRequests) app.use(morgan(env.isProduction ? 'combined' : 'dev'))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))
// Readiness for load balancers: 503 while the database is not connected.
app.get('/health/ready', (_req, res) => {
  const dbUp = mongoose.connection.readyState === 1
  res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ready' : 'not_ready', db: dbUp ? 'up' : 'down', ...overloadStats() })
})
app.get('/api-docs.json', (_req, res) => res.json(openApiSpec))
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec, { swaggerOptions: { persistAuthorization: true } }))
// Uploaded documents and photos; the admin panel (another origin) displays them.
app.use(
  '/uploads',
  express.static(env.uploadDir, {
    index: false,
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
  }),
)

// Everything under /api: rate limit, no caching, and no NoSQL operators / prototype keys in input.
app.use('/api', apiLimiter, noStore, sanitizeRequest)

app.use('/api/v1/admin', adminRoutes)
// Customer and rider apps (SRS §10). Sign-in: /api/v1/app/auth for the Flutter customer app, /api/v1/rider/auth for riders.
app.use('/api/v1/customer', customerRoutes)
app.use('/api/v1/rider', riderRoutes)
app.use('/api/v1/common', commonRouter)
app.use('/api/v1/public', publicRouter)
app.use('/api/v1/app', appRoutes)

app.use(notFoundHandler)
app.use(errorHandler)
