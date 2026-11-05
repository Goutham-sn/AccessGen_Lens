import { Session } from '../models/Session.js'
import { Frame } from '../models/Frame.js'
import { compileFramesToVideo } from '../utils/frameVideo.js'

// Kept apart from queue.js on purpose: importing the queues opens Redis
// connections, which would keep anything that only needs this alive.
// Builds the session video from the captured frames, unless a real tab
// recording got there first (it is smoother, so it always wins).
// Returns 'video' (built), 'frames' (could not build one, but the frames
// can still be played back as pictures), or null (nothing to show).
export async function videoFromFrames(sessionId, io) {
  const session = await Session.findById(sessionId)
  if (!session || session.video_url || session.source === 'runner') return session?.video_url ? 'video' : null
  const frames = await Frame.findBySession(sessionId)
  const playable = frames.filter((f) => f.frame_index > 0).length >= 2

  let result = null
  try {
    result = await compileFramesToVideo(session, frames)
  } catch (err) {
    console.error(`[video] session ${sessionId}: could not build the video from frames: ${err.message}` +
      (err.code === 'ENOENT' ? ' (ffmpeg is not installed: rebuild the backend image with docker compose up -d --build backend)' : ''))
  }

  const latest = await Session.findById(sessionId)
  if (latest?.video_url) return 'video'
  if (result) {
    await Session.update(sessionId, {
      video_url: result.key,
      recording_offset_ms: result.offsetMs,
      status: 'complete',
      processing_complete: true
    })
    io?.to(`session:${sessionId}`).emit('session-processed', { sessionId, videoUrl: result.key })
    console.log(`[video] session ${sessionId}: video built from ${frames.length} frames`)
    return 'video'
  }
  if (playable) {
    // No video file, but the pictures play back in the browser. The
    // session is finished: never leave it "processing".
    await Session.update(sessionId, { status: 'complete', processing_complete: true })
    io?.to(`session:${sessionId}`).emit('session-processed', { sessionId, videoUrl: null })
    return 'frames'
  }
  return null
}
