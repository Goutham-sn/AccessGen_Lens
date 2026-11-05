import { Session } from '../models/Session.js'
import { missionComparison } from '../utils/mission.js'
import { noMomentsText } from '../utils/lookedAt.js'
import { Frame } from '../models/Frame.js'
import { Event } from '../models/Event.js'
import { EmpathyMoment } from '../models/EmpathyMoment.js'

// Full playback payload: session meta, video URL, frames (for scrub thumbnails),
// events and empathy moments for the timeline.
export async function getPlayback(req, res, next) {
  try {
    const session = await Session.findById(req.params.id)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    if (session.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })

    const [frames, events, empathyMoments, uploadWindow] = await Promise.all([
      Frame.findBySession(session.id),
      Event.findBySession(session.id),
      EmpathyMoment.findBySession(session.id),
      Session.uploadWindow(session.id)
    ])

    // uploadWindow: { open, waitUntil }. Playback keeps waiting for a video
    // only while open is true, as decided by the database clock.
    const baseline = session.baseline_session_id ? await Session.findById(session.baseline_session_id) : null
    res.json({ mission: missionComparison(session, baseline?.user_id === session.user_id ? baseline : null), session, frames, events, empathyMoments, uploadWindow, noMomentsText: noMomentsText(session, empathyMoments.length) })
  } catch (err) { next(err) }
}
