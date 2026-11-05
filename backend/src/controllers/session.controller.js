import { Session } from '../models/Session.js'
import { EmpathyMoment } from '../models/EmpathyMoment.js'
import { enqueueSessionProcessing } from '../jobs/queue.js'
import { putDataUrl } from '../utils/storage.js'
import { newUploadToken, UPLOAD_TOKEN_TTL_HOURS } from '../utils/uploadToken.js'
import { deleteSessionAndMedia } from '../utils/deleteSession.js'

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
      // The extension says whether a tab recording is still on its way.
      // Without one, the video is built from the captured frames at once.
      const recordingExpected = req.body?.recordingExpected !== false
      session = await Session.update(session.id, { recording_expected: recordingExpected })
      await enqueueSessionProcessing(session.id, { recordingExpected })
    }
    res.json({ session })
  } catch (err) { next(err) }
}

// Owner or upload token, checked by sessionWriter('moments') in the route.
export async function logEmpathyMoment(req, res, next) {
  try {
    const session = await Session.findById(req.params.id)
    if (!session) return res.status(404).json({ error: 'Session not found' })

    const { timestampMs, frameIndex, label, note, screenshot, activeProfiles, detector, profileId, rect } = req.body
    if (!label || typeof label !== 'string') return res.status(400).json({ error: 'A label is required' })
    // 'extension-auto': noticed by the simulation itself (friction.js), not
    // logged by the tester. Nothing else may be claimed from here.
    const source = req.body.source === 'extension-auto' ? 'extension-auto' : 'extension'
    const cleanRect = rect && ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(rect[k]))
      ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
      : null

    let screenshotUrl = null
    if (screenshot) {
      screenshotUrl = await putDataUrl(
        `sessions/${session.id}/moments/${Date.now()}.jpg`, screenshot
      )
    }

    const moment = await EmpathyMoment.create({
      sessionId: session.id,
      timestampMs: timestampMs ?? 0,
      frameIndex,
      label: label.slice(0, 255),
      note: typeof note === 'string' ? note.slice(0, 1000) : null,
      screenshotUrl,
      activeProfiles,
      source,
      detector: source === 'extension-auto' && typeof detector === 'string' ? detector.slice(0, 64) : null,
      profileId: typeof profileId === 'string' ? profileId.slice(0, 64) : null,
      rect: cleanRect
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
    // A run still going would write new pictures after the delete.
    if (session.source === 'runner' && !session.processing_complete) {
      return res.status(409).json({ error: 'This run is still going. Please wait for it to finish before deleting it.' })
    }
    // The row and everything it stored: video, frames, moment pictures, PDF.
    const { removed } = await deleteSessionAndMedia(session.id)
    res.json({ ok: true, removedObjects: removed })
  } catch (err) { next(err) }
}
