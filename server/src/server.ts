import http from 'http'
import mongoose from 'mongoose'
import { app } from './app'
import { connectDb } from './config/db'
import { env } from './config/env'
import { initRealtime } from './realtime/socket'
import { startDispatchSweeper } from './services/dispatch'

const SHUTDOWN_GRACE_MS = 10_000

async function main() {
  await connectDb()
  const server = http.createServer(app)

  // Connection limits so slow or abusive clients cannot hold sockets open forever.
  server.keepAliveTimeout = 65_000 // longer than common load balancer idle timeouts (60 s)
  server.headersTimeout = 66_000
  server.requestTimeout = 60_000
  server.maxRequestsPerSocket = 1000

  const io = initRealtime(server)
  startDispatchSweeper()
  server.on('error', (err: NodeJS.ErrnoException) => {
    console.error(err.code === 'EADDRINUSE' ? `[server] port ${env.port} is already in use: stop the other server first` : '[server] error', err.code === 'EADDRINUSE' ? '' : err)
    process.exit(1)
  })
  server.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port} (Socket.IO: /customer, /rider, /admin)`)
  })

  // Graceful shutdown (deploy / restart): stop taking new connections, let running requests finish, then close the DB.
  let shuttingDown = false
  const shutdown = (reason: string, exitCode = 0) => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`[server] shutting down (${reason})`)
    const force = setTimeout(() => {
      console.error('[server] shutdown timed out, exiting')
      process.exit(exitCode || 1)
    }, SHUTDOWN_GRACE_MS)
    force.unref()
    // Close idle keep-alive connections now (they would keep the port busy) and the rest after a short wait.
    server.close(() => {
      void mongoose.connection.close().finally(() => process.exit(exitCode))
    })
    server.closeIdleConnections()
    setTimeout(() => server.closeAllConnections(), 3000).unref()
    void io.close()
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  // A failed background promise must never take the whole API down: log it and keep serving.
  process.on('unhandledRejection', (reason) => {
    console.error('[process] unhandled rejection', reason)
  })
  // After an uncaught exception the process state is unknown. Log it, finish what is running and exit;
  // a process manager (PM2, systemd, Docker) then starts a fresh one.
  process.on('uncaughtException', (err) => {
    console.error('[process] uncaught exception', err)
    shutdown('uncaughtException', 1)
  })
}

main().catch((err) => {
  console.error('[server] failed to start', err)
  process.exit(1)
})
