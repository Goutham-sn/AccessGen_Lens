import { Session } from '../models/Session.js'
import { Frame } from '../models/Frame.js'
import { enqueueFinalizeCheck } from './queue.js'
import { videoFromFrames } from './videoFromFrames.js'

// Runs when a session ends: pick a thumbnail, then either build the video
// from frames now (no tab recording is coming) or give the tab recording,
// uploaded separately by the extension, its time to arrive.
export async function processSession(sessionId, { recordingExpected = true } = {}, io) {
  const session = await Session.findById(sessionId)
  if (!session) return

  if (!session.page_thumbnail) {
    const frames = await Frame.findBySession(sessionId)
    // The first real frame shows the page with the simulation on.
    const first = frames.find((f) => f.frame_index > 0) || frames[0]
    if (first) await Session.update(sessionId, { page_thumbnail: first.screenshot_url })
  }

  if (!recordingExpected) {
    let outcome = null
    try {
      outcome = await videoFromFrames(sessionId, io)
    } catch (err) {
      console.error(`[video] session ${sessionId}: processing failed:`, err.message)
    }
    if (!outcome) {
      // Nothing was captured at all: say so now instead of in 90 seconds.
      await Session.update(sessionId, { status: 'no_video', processing_complete: true })
      io?.to(`session:${sessionId}`).emit('session-processed', { sessionId, videoUrl: null })
    }
    return
  }
  await enqueueFinalizeCheck(sessionId)
}
