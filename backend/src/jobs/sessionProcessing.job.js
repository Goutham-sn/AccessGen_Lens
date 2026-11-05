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
    try {
      await videoFromFrames(sessionId, io)
    } catch (err) {
      console.error(`[video] session ${sessionId}: could not build the video from frames:`, err.message)
    }
  }
  await enqueueFinalizeCheck(sessionId)
}
