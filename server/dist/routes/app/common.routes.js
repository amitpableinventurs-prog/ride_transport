"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.legalPagesRouter = exports.publicRouter = exports.commonRouter = void 0;
const express_1 = require("express");
const common = __importStar(require("../../controllers/common/common.controller"));
const errorLogs = __importStar(require("../../controllers/errorLogs.controller"));
const appAuth_1 = require("../../middleware/appAuth");
const rateLimits_1 = require("../../middleware/rateLimits");
// SRS §10.5 common APIs, mounted at /api/v1/common.
exports.commonRouter = (0, express_1.Router)();
exports.commonRouter.get('/app-config', common.getAppConfig);
exports.commonRouter.get('/cms/:slug', common.getCmsPage);
exports.commonRouter.post('/devices', appAuth_1.requireAppAuth, common.registerDevice);
// Crash and error reports from the apps (admin panel: System → Error Logs). Login is optional.
exports.commonRouter.post('/error-logs', rateLimits_1.errorReportLimiter, appAuth_1.optionalAppAuth, errorLogs.reportAppError);
// Pages opened from shared links without logging in, mounted at /api/v1/public.
exports.publicRouter = (0, express_1.Router)();
exports.publicRouter.get('/track/:token', common.publicTrack);
exports.publicRouter.get('/invoices/:token', common.publicInvoice);
// Terms and privacy as web pages at the site root (/terms, /privacy, /rider-terms).
exports.legalPagesRouter = (0, express_1.Router)();
exports.legalPagesRouter.get(Object.keys(common.LEGAL_PAGE_PATHS), common.legalPage);
//# sourceMappingURL=common.routes.js.map