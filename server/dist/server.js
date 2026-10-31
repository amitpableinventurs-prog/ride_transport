
"use strict";

const http = require("http");
const mongoose = require("mongoose");

const { app } = require("./app");
const { connectDb } = require("./config/db");
const { env } = require("./config/env");
const { initRealtime } = require("./realtime/socket");
const { startDispatchSweeper } = require("./services/dispatch");
const { startGatewayReconciler } = require("./services/gatewayPayments");
const { recordServerError } = require("./utils/errorLogs");

// Hostinger PORT configuration
const PORT = Number(process.env.PORT || env.port || 5050);
const HOST = "0.0.0.0";

const SHUTDOWN_GRACE_MS = 10000;

let shuttingDown = false;
let backgroundServicesStarted = false;

// Health check endpoint
app.get("/health", (req, res) => {
    const dbConnected = mongoose.connection.readyState === 1;

    res.status(200).json({
        success: true,
        message: "Ride Transport API is running",
        server: "online",
        database: dbConnected ? "connected" : "disconnected",
        timestamp: new Date().toISOString()
    });
});

// Create HTTP server
const server = http.createServer(app);

// Server timeout configuration
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;
server.requestTimeout = 60000;

// Socket.IO
let io;

async function startBackgroundServices() {
    if (backgroundServicesStarted) return;

    backgroundServicesStarted = true;

    try {
        io = initRealtime(server);

        startDispatchSweeper();
        startGatewayReconciler();

        console.log("[server] Socket.IO initialized");
        console.log("[server] Background services started");

    } catch (error) {
        backgroundServicesStarted = false;
        console.error("[server] Background service error:", error);

        try {
            await recordServerError(error);
        } catch (logError) {
            console.error("[server] Error logging failed:", logError);
        }
    }
}

// Graceful shutdown
function shutdown(reason, exitCode = 0) {
    if (shuttingDown) return;

    shuttingDown = true;

    console.log(`[server] shutting down: ${reason}`);

    const force = setTimeout(() => {
        console.error("[server] shutdown timeout");
        process.exit(1);
    }, SHUTDOWN_GRACE_MS);

    force.unref();

    if (io) {
        try {
            io.close();
        } catch (error) {
            console.error("[server] Socket shutdown error:", error);
        }
    }

    server.close(async () => {
        try {
            await mongoose.connection.close();
        } catch (error) {
            console.error("[server] DB shutdown error:", error);
        }

        clearTimeout(force);
        process.exit(exitCode);
    });

    if (typeof server.closeIdleConnections === "function") {
        server.closeIdleConnections();
    }

    setTimeout(() => {
        if (typeof server.closeAllConnections === "function") {
            server.closeAllConnections();
        }
    }, 3000).unref();
}

// Start server FIRST, then connect MongoDB
server.on("error", (error) => {
    console.error("[server] HTTP server error:", error);

    if (error.code === "EADDRINUSE") {
        console.error(`[server] Port ${PORT} is already in use`);
    }

    shutdown("server error", 1);
});

server.listen(PORT, HOST, async () => {
    console.log(`[server] API running on ${HOST}:${PORT}`);
    console.log(`[server] Health: /health`);

    // MongoDB connection after HTTP server starts
    try {
        await connectDb();

        console.log("[server] MongoDB connected successfully");

        if (!shuttingDown) {
            await startBackgroundServices();
        }

    } catch (error) {
        console.error("[server] MongoDB connection failed:", error);

        try {
            await recordServerError(error);
        } catch (logError) {
            console.error("[server] Error logging failed:", logError);
        }

        console.error(
            "[server] HTTP server remains online, but database APIs may not work"
        );
    }
});

// Process events
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", async (reason) => {
    console.error("[process] unhandled rejection:", reason);

    try {
        await recordServerError(reason);
    } catch (error) {
        console.error("[process] Error logging failed:", error);
    }
});

process.on("uncaughtException", (error) => {
    console.error("[process] uncaught exception:", error);
    shutdown("uncaughtException", 1);
});
