"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const mongoose_1 = __importDefault(require("mongoose"));
const app_1 = require("./app");
const db_1 = require("./config/db");
const env_1 = require("./config/env");
const socket_1 = require("./realtime/socket");
const dispatch_1 = require("./services/dispatch");
const gatewayPayments_1 = require("./services/gatewayPayments");
const errorLogs_1 = require("./utils/errorLogs");
const SHUTDOWN_GRACE_MS = 10_000;
async function main() {
    const server = http_1.default.createServer(app_1.app);
    // Connection limits so slow or abusive clients cannot hold sockets open forever.
    server.keepAliveTimeout = 65_000; // longer than common load balancer idle timeouts (60 s)
    server.headersTimeout = 66_000;
    server.requestTimeout = 60_000;
    server.maxRequestsPerSocket = 1000;
    const io = (0, socket_1.initRealtime)(server);
    server.on('error', (err) => {
        console.error(err.code === 'EADDRINUSE' ? `[server] port ${env_1.env.port} is already in use: stop the other server first` : '[server] error', err.code === 'EADDRINUSE' ? '' : err);
        process.exit(1);
    });
    // Listen before connecting to MongoDB: Hostinger shows a 503 while the app is not listening, so a database
    // problem would otherwise hide behind it. /health/ready reports the database state instead.
    server.listen(env_1.env.port, '0.0.0.0', () => {
        console.log(`[server] listening on http://localhost:${env_1.env.port} (Socket.IO: /customer, /rider, /admin)`);
    });
    // Graceful shutdown (deploy / restart): stop taking new connections, let running requests finish, then close the DB.
    let shuttingDown = false;
    const shutdown = (reason, exitCode = 0) => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        console.log(`[server] shutting down (${reason})`);
        const force = setTimeout(() => {
            console.error('[server] shutdown timed out, exiting');
            process.exit(exitCode || 1);
        }, SHUTDOWN_GRACE_MS);
        force.unref();
        // Close idle keep-alive connections now (they would keep the port busy) and the rest after a short wait.
        server.close(() => {
            void mongoose_1.default.connection.close().finally(() => process.exit(exitCode));
        });
        server.closeIdleConnections();
        setTimeout(() => server.closeAllConnections(), 3000).unref();
        void io.close();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    // A failed background promise must never take the whole API down: log it and keep serving.
    process.on('unhandledRejection', (reason) => {
        console.error('[process] unhandled rejection', reason);
        void (0, errorLogs_1.recordServerError)(reason);
    });
    // After an uncaught exception the process state is unknown. Log it, finish what is running and exit;
    // a process manager (PM2, systemd, Docker) then starts a fresh one.
    process.on('uncaughtException', (err) => {
        console.error('[process] uncaught exception', err);
        shutdown('uncaughtException', 1);
    });
    try {
        await (0, db_1.connectDb)();
    }
    catch (err) {
        console.error('[db] connection failed: the API keeps running, but requests that need the database will fail', err);
        return;
    }
    // The sweepers read the database every few seconds, so they only start once it is reachable.
    (0, dispatch_1.startDispatchSweeper)();
    (0, gatewayPayments_1.startGatewayReconciler)();
}
main().catch((err) => {
    console.error('[server] failed to start', err);
    process.exit(1);
});
//# sourceMappingURL=server.js.map