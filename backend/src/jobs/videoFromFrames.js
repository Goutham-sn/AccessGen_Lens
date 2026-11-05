import { Session } from '../models/Session.js'
import { Frame } from '../models/Frame.js'
import { compileFramesToVideo } from '../utils/frameVideo.js'

// Kept apart from queue.js on purpose: importing the queues opens Redis
// connections, which would keep anything that only needs this alive.
// Builds the session video from the captured frames, unless a real tab
// recording got there first (it is smoother, so it always wins).
export async function videoFromFrames(sessionId, io) {
  const session = await Session.findById(sessionId)
  if (!session || session.video_url || session.source === 'runner') return false
  const frames = await Frame.findBySession(sessionId)
  const result = await compileFramesToVideo(session, frames)
  if (!result) return false
  const latest = await Session.findById(sessionId)
  if (latest?.video_url) return false
  await Session.update(sessionId, {
    video_url: result.key,
    recording_offset_ms: result.offsetMs,
    status: 'complete',
    processing_complete: true
  })
  io?.to(`session:${sessionId}`).emit('session-processed', { sessionId, videoUrl: result.key })
  console.log(`[video] session ${sessionId}: video built from ${frames.length} frames`)
  return true
}

