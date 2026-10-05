import { Session } from '../models/Session.js'
import { EmpathyMoment } from '../models/EmpathyMoment.js'
import { enqueueSessionProcessing } from '../jobs/queue.js'
import { putDataUrl } from '../utils/storage.js'
import { newUploadToken, UPLOAD_TOKEN_TTL_HOURS } from '../utils/uploadToken.js'

function assertOwner(session, req, res) {
  if (!session) {
    res.status(404).json({ error: 'Session not found' })
    return false
  }
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' })
    return false
  }
  // Sessions with no owner are never handed to anyone.
  if (session.user_id == null || session.user_id !== req.user.id) {
    res.status(403).json({ error: 'You do not have access to this session' })
    return false
  }
  return true
}

export async function createSession(req, res, next) {
  try {
    const { url, pageTitle, activeProfiles, personaId, personaSnapshot } = req.body
    if (!url) return res.status(400).json({ error: 'A URL is required' })
    const session = await Session.create({
      userId: req.user.id, url, pageTitle, activeProfiles, personaId, personaSnapshot
    })
    // Returned once, here, to the signed-in owner, who hands it to the
    // extension. Only its hash is stored. Never log it.
    const { token, hash } = newUploadToken()
    await Session.setUploadToken(session.id, hash, UPLOAD_TOKEN_TTL_HOURS)
    res.status(201).json({ session, uploadToken: token })
  } catch (err) { next(err) }
}

export async function listSessions(req, res, next) {
  try {
    const sessions = await Session.findByUser(req.user.id, {
      limit: Math.min(parseInt(req.query.limit || '50', 10), 100),
      offset: parseInt(req.query.offset || '0', 10)
    })
    res.json({ sessions })
  } catch (err) { next(err) }
}

export async function getSession(req, res, next) {
  try {
    const session = await Session.findById(req.params.id)
    if (!assertOwner(session, req, res)) return
    const empathyMoments = await EmpathyMoment.findBySession(session.id)
    res.json({ session, empathyMoments })
  } catch (err) { next(err) }
}

// Owner or upload token, checked by sessionWriter('end') in the route.
export async function endSession(req, res, next) {
  try {
    let session = await Session.findById(req.params.id)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    // Frames and moments stop now; the recording gets its grace period.
    await Session.closeUploads(session.id)
    if (session.status === 'recording') {
      session = await Session.end(session.id)
      await enqueueSessionProcessing(session.id)
    }
    res.json({ session })
  } catch (err) { next(err) }
}

// Owner or upload token, checked by sessionWriter('moments') in the route.
export async function logEmpathyMoment(req, res, next) {
  try {
    const session = await Session.findById(req.params.id)
    if (!session) return res.status(404).json({ error: 'Session not found' })

    const { timestampMs, frameIndex, label, note, screenshot, activeProfiles } = req.body
    if (!label) return res.status(400).json({ error: 'A label is required' })

    let screenshotUrl = null
    if (screenshot) {
      screenshotUrl = await putDataUrl(
        `sessions/${session.id}/moments/${Date.now()}.jpg`, screenshot
      )
    }

    const moment = await EmpathyMoment.create({
      sessionId: session.id,
      timestampMs: timestampMs ?? 0,
      frameIndex, label, note, screenshotUrl, activeProfiles
    })
    await Session.incrementCounts(session.id, { moments: 1 })

    req.app.get('io')?.to(`session:${session.id}`).emit('empathy-moment', moment)
    res.status(201).json({ moment })
  } catch (err) { next(err) }
}

export async function deleteSession(req, res, next) {
  try {
    const session = await Session.findById(req.params.id)
    if (!assertOwner(session, req, res)) return
    await Session.delete(session.id)
    res.json({ ok: true })
  } catch (err) { next(err) }
}
