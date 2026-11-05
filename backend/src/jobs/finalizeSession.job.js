import { Session } from '../models/Session.js'
import { videoFromFrames } from './videoFromFrames.js'

// Delayed fallback so a session never sits at "processing" forever if the
// recording upload never shows up. The captured frames are used first; only
// with neither does it end as no_video, so "finished with a video" is never
// confused with "gave up waiting". A late upload inside the grace period
// still moves it to complete.
export async function finalizeIfStillPending(sessionId, io) {
  const session = await Session.findById(sessionId)
  if (!session || session.processing_complete) return

  try {
    if (await videoFromFrames(sessionId, io)) return
  } catch (err) {
    console.error(`[video] session ${sessionId}: could not build the video from frames:`, err.message)
  }

  await Session.update(sessionId, { status: 'no_video', processing_complete: true })
  io?.to(`session:${sessionId}`).emit('session-processed', {
    sessionId,
    videoUrl: session.video_url || null
  })
}
