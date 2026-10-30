"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
require("express-async-errors");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const env_1 = require("./config/env");
const routes_1 = __importDefault(require("./routes"));
const app_1 = __importDefault(require("./routes/app"));
const customer_routes_1 = __importDefault(require("./routes/app/customer.routes"));
const rider_routes_1 = __importDefault(require("./routes/app/rider.routes"));
const common_routes_1 = require("./routes/app/common.routes");
const errorHandler_1 = require("./middleware/errorHandler");
const security_1 = require("./middleware/security");
const overload_1 = require("./middleware/overload");
const openapi_1 = require("./docs/openapi");
const webhooks_controller_1 = require("./controllers/webhooks.controller");
const mongoose_1 = __importDefault(require("mongoose"));
exports.app = (0, express_1.default)();
exports.app.disable('x-powered-by');
if (env_1.env.trustProxy > 0)
    exports.app.set('trust proxy', env_1.env.trustProxy);
// First in line: turn requests away cheaply when overloaded and never let one hang forever.
exports.app.use(overload_1.overloadGuard, overload_1.requestTimeout);
// Swagger UI is served over plain http locally, so skip helmet's upgrade-insecure-requests there.
const defaultHelmet = (0, helmet_1.default)();
const docsHelmet = (0, helmet_1.default)({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: null } } });
exports.app.use((req, res, next) => (req.path === '/api-docs' || req.path.startsWith('/api-docs/') ? docsHelmet : defaultHelmet)(req, res, next));
exports.app.use((0, cors_1.default)({ origin: env_1.env.corsOrigin }));
// Gateway webhooks need the raw body for the signature check, so they come before the JSON parser.
exports.app.post('/api/v1/webhooks/razorpay', express_1.default.raw({ type: 'application/json', limit: '100kb' }), webhooks_controller_1.razorpayWebhook);
exports.app.use(express_1.default.json({ limit: '100kb' }));
if (env_1.env.logRequests)
    exports.app.use((0, morgan_1.default)(env_1.env.isProduction ? 'combined' : 'dev'));
exports.app.get('/health', (_req, res) => res.json({ status: 'ok' }));
// Readiness for load balancers: 503 while the database is not connected.
exports.app.get('/health/ready', (_req, res) => {
    const dbUp = mongoose_1.default.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ready' : 'not_ready', db: dbUp ? 'up' : 'down', ...(0, overload_1.overloadStats)() });
});
exports.app.get('/api-docs.json', (_req, res) => res.json(openapi_1.openApiSpec));
exports.app.use('/api-docs', swagger_ui_express_1.default.serve, swagger_ui_express_1.default.setup(openapi_1.openApiSpec, { swaggerOptions: { persistAuthorization: true } }));
// Uploaded documents and photos; the admin panel (another origin) displays them.
exports.app.use('/uploads', express_1.default.static(env_1.env.uploadDir, {
    index: false,
    setHeaders: (res) => res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin'),
}));
// Everything under /api: rate limit, no caching, and no NoSQL operators / prototype keys in input.
exports.app.use('/api', security_1.apiLimiter, security_1.noStore, security_1.sanitizeRequest);
exports.app.use('/api/v1/admin', routes_1.default);
// Customer and rider apps (SRS §10). Sign-in: /api/v1/app/auth for the Flutter customer app, /api/v1/rider/auth for riders.
exports.app.use('/api/v1/customer', customer_routes_1.default);
exports.app.use('/api/v1/rider', rider_routes_1.default);
exports.app.use('/api/v1/common', common_routes_1.commonRouter);
exports.app.use('/api/v1/public', common_routes_1.publicRouter);
exports.app.use('/api/v1/app', app_1.default);
// Terms and privacy web pages for the store listings: /terms, /privacy, /rider-terms.
exports.app.use(security_1.apiLimiter, common_routes_1.legalPagesRouter);
exports.app.use(errorHandler_1.notFoundHandler);
exports.app.use(errorHandler_1.errorHandler);
//# sourceMappingURL=app.js.map