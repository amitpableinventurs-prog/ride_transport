import http from 'http'
import { app } from './app'
import { connectDb } from './config/db'
import { env } from './config/env'
import { initRealtime } from './realtime/socket'
import { startDispatchSweeper } from './services/dispatch'

async function main() {
  await connectDb()
  const server = http.createServer(app)
  initRealtime(server)
  startDispatchSweeper()
  server.listen(env.port, () => {
    console.log(`[server] listening on http://localhost:${env.port} (Socket.IO: /customer, /rider, /admin)`)
  })
}

main().catch((err) => {
  console.error('[server] failed to start', err)
  process.exit(1)
})
