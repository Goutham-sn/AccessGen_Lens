import { verifyAccessToken } from '../utils/jwt.js'
import { Session } from '../models/Session.js'
import { getLocalUser } from '../config/localUser.js'

// Realtime channel between the extension (publisher) and the web app (subscriber).
// Events relayed per session room:
//   cognitive-load     { sessionId, score }
//   sr-announcement    { sessionId, text, element }
//   focus-change       { sessionId, element, tabIndex }
//   session-event      { sessionId, event }
//   empathy-moment     (emitted by REST controller)
//   session-processed  (emitted by video job)
export function attachSessionSocket(io) {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (token) {
      try {
        const decoded = verifyAccessToken(token)
        socket.user = { id: decoded.sub }
      } catch {
        /* allow anonymous: the extension relays without user context */
      }
    }
    // No sign-in: the web app connects as the local user.
    if (!socket.user && getLocalUser()) socket.user = { id: getLocalUser().id }
    next()
  })

  io.on('connection', (socket) => {
    // Only the session's owner may listen to its room. Sessions with no
    // owner are closed to everyone, same as the REST routes.
    socket.on('join-session', async ({ sessionId } = {}) => {
      if (typeof sessionId !== 'string' || !sessionId) return
      try {
        const session = await Session.findById(sessionId)
        if (!session) return
        if (session.user_id == null || session.user_id !== socket.user?.id) return
        socket.join(`session:${sessionId}`)
      } catch {
        // Malformed id or database hiccup: do not join.
      }
    })

    socket.on('leave-session', ({ sessionId }) => {
      if (sessionId) socket.leave(`session:${sessionId}`)
    })

    for (const event of ['cognitive-load', 'sr-announcement', 'focus-change', 'session-event', 'recording-status']) {
      socket.on(event, (payload) => {
        if (payload?.sessionId) {
          socket.to(`session:${payload.sessionId}`).emit(event, payload)
        }
      })
    }
  })
}
