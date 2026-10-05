import { Session } from '../models/Session.js'

// Delayed fallback so a session never sits at "processing" forever if the
// recording upload never shows up.
export async function finalizeIfStillPending(sessionId, io) {
  const session = await Session.findById(sessionId)
  if (!session || session.processing_complete) return

  await Session.update(sessionId, { status: 'complete', processing_complete: true })
  io?.to(`session:${sessionId}`).emit('session-processed', {
    sessionId,
    videoUrl: session.video_url || null
  })
}
