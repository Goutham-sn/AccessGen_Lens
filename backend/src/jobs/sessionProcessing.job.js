import { Session } from '../models/Session.js'
import { Frame } from '../models/Frame.js'
import { enqueueFinalizeCheck } from './queue.js'

// Runs when a session ends: pick up the one-time thumbnail the page
// uploaded when recording started, and schedule a fallback check in case
// the actual recording (uploaded independently and asynchronously by the
// extension's offscreen document) never arrives.
export async function processSession(sessionId) {
  const session = await Session.findById(sessionId)
  if (!session) return

  if (!session.page_thumbnail) {
    const frames = await Frame.findBySession(sessionId)
    if (frames.length > 0) {
      await Session.update(sessionId, { page_thumbnail: frames[0].screenshot_url })
    }
  }

  await enqueueFinalizeCheck(sessionId)
}
