import Redis from 'ioredis'
import { Emitter } from '@socket.io/redis-emitter'
import { config } from './config.js'

// Publishes to the backend's session rooms through its Redis adapter. The
// runner never opens a socket of its own.
const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: null })
redis.on('error', (err) => console.error('[runner] redis', err.message))
const emitter = new Emitter(redis)

// Plain phase names, shown in the Run page's status region.
export const PHASES = {
  queued: 'Waiting for a free browser',
  opening: 'Opening the page',
  walking: 'Pressing Tab through the page',
  looking: 'Looking through the page',
  saving: 'Saving the video',
  done: 'Ready'
}

export const progress = {
  phase(sessionId, phase) {
    emitter.to(`session:${sessionId}`).emit('run-phase', { sessionId, phase, label: PHASES[phase] || phase })
  },
  // Each moment as soon as it is captured, so the Run page can show it.
  moment(sessionId, m) {
    emitter.to(`session:${sessionId}`).emit('run-moment', {
      sessionId, number: m.number, headline: m.headline, videoMs: m.videoMs, patternCount: m.pattern?.count ?? 1
    })
  },
  done(sessionId, payload) {
    emitter.to(`session:${sessionId}`).emit('run-done', { sessionId, ...payload })
    // Playback already refetches on this event.
    emitter.to(`session:${sessionId}`).emit('session-processed', { sessionId, videoUrl: payload.videoUrl || null })
  },
  redis
}
