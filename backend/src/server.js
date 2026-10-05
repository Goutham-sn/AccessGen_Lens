import http from 'http'
import { Server } from 'socket.io'
import { createAdapter } from '@socket.io/redis-adapter'
import { redis } from './config/redis.js'
import { createApp } from './app.js'
import { requireEnv } from './config/requireEnv.js'
import { migrate } from './config/database.js'
import { ensureBucket } from './config/storage.js'
import { attachSessionSocket } from './socket/session.socket.js'
import { startWorkers } from './jobs/queue.js'
import { seedBuiltInPersonas } from './config/seed.js'

const PORT = process.env.PORT || 3001

// The other secrets are checked where they are used (storage.js for MinIO).
requireEnv('DATABASE_URL', 'JWT_SECRET', 'JWT_REFRESH_SECRET')

async function main() {
  await migrate()
  await ensureBucket()
  await seedBuiltInPersonas()

  const app = createApp()
  const server = http.createServer(app)

  const io = new Server(server, {
    cors: {
      origin: [process.env.WEB_APP_URL || 'http://localhost:5173', /^chrome-extension:\/\//],
      credentials: true
    }
  })
  // Redis adapter so the runner service can publish to session rooms
  // through @socket.io/redis-emitter without a socket connection of its own.
  io.adapter(createAdapter(redis.duplicate(), redis.duplicate()))
  app.set('io', io)
  attachSessionSocket(io)
  startWorkers(io)

  server.listen(PORT, () => {
    console.log(`[server] AccessGen Lens backend on http://localhost:${PORT}`)
  })
}

main().catch((err) => {
  console.error('[server] fatal startup error:', err)
  process.exit(1)
})
