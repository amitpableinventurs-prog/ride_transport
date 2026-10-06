import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import swaggerUi from 'swagger-ui-express'
import { env } from './config/env'
import adminRoutes from './routes'
import appRoutes from './routes/app'
import appAuthRoutes from './routes/app/auth.routes'
import customerRoutes from './routes/app/customer.routes'
import riderRoutes from './routes/app/rider.routes'
import { commonRouter, publicRouter } from './routes/app/common.routes'
import { errorHandler, notFoundHandler } from './middleware/errorHandler'
import { openApiSpec } from './docs/openapi'

export const app = express()

// Swagger UI is served over plain http locally, so skip helmet's upgrade-insecure-requests there.
const defaultHelmet = helmet()
const docsHelmet = helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } })
app.use((req, res, next) => (req.path === '/api-docs' || req.path.startsWith('/api-docs/') ? docsHelmet : defaultHelmet)(req, res, next))
app.use(cors({ origin: env.corsOrigin }))
app.use(express.json())
app.use(morgan(env.isProduction ? 'combined' : 'dev'))

app.get('/health', (_req, res) => res.json({ status: 'ok' }))
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

app.use('/api/v1/admin', adminRoutes)
// Customer and rider apps (SRS §10). /api/v1/app is the earlier app API, kept for existing builds.
app.use('/api/v1/auth', appAuthRoutes)
app.use('/api/v1/customer', customerRoutes)
app.use('/api/v1/rider', riderRoutes)
app.use('/api/v1/common', commonRouter)
app.use('/api/v1/public', publicRouter)
app.use('/api/v1/app', appRoutes)

app.use(notFoundHandler)
app.use(errorHandler)
