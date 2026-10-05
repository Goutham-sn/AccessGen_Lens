import { Session } from '../models/Session.js'
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

    const [frames, events, empathyMoments] = await Promise.all([
      Frame.findBySession(session.id),
      Event.findBySession(session.id),
      EmpathyMoment.findBySession(session.id)
    ])

    res.json({ session, frames, events, empathyMoments })
  } catch (err) { next(err) }
}
