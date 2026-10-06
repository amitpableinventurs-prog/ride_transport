import 'express-async-errors'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import swaggerUi from 'swagger-ui-express'
import { env } from './config/env'
import adminRoutes from './routes'
import appRoutes from './routes/app'
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
app.use('/api/v1/admin', adminRoutes)
app.use('/api/v1/app', appRoutes)

app.use(notFoundHandler)
app.use(errorHandler)
