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
      sessionId, number: m.number, headline: m.headline, videoMs: m.videoMs, patternCount: m.pattern?.count ?? 1,
      fact: m.fact, detector: m.detector, element: m.element ? { role: m.element.role, name: m.element.name } : null
    })
  },
  // What is happening right now, in plain words, for the live log:
  // "Tab 14: link 'Pricing'", "The rules engine found 23 problems".
  log(sessionId, text, extra = {}) {
    emitter.to(`session:${sessionId}`).emit('run-log', { sessionId, at: Date.now(), text: String(text).slice(0, 300), ...extra })
  },
  // A picture of the runner's browser, so the Run page shows the page itself.
  frame(sessionId, jpegBase64, pass) {
    emitter.to(`session:${sessionId}`).emit('run-frame', { sessionId, at: Date.now(), pass, src: `data:image/jpeg;base64,${jpegBase64}` })
  },
  done(sessionId, payload) {
    emitter.to(`session:${sessionId}`).emit('run-done', { sessionId, ...payload })
    // Playback already refetches on this event.
    emitter.to(`session:${sessionId}`).emit('session-processed', { sessionId, videoUrl: payload.videoUrl || null })
  },
  redis
}
