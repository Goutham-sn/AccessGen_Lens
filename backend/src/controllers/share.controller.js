import bcrypt from 'bcryptjs'
import { SIMULATION_INTRO, SNAPSHOT_NOTE } from '../config/copy.js'
import { lookedAt, noMomentsText } from '../utils/lookedAt.js'
import { nanoid } from 'nanoid'
import { Session } from '../models/Session.js'
import { missionComparison } from '../utils/mission.js'
import { SharedReport } from '../models/SharedReport.js'
import { Frame } from '../models/Frame.js'
import { EmpathyMoment } from '../models/EmpathyMoment.js'

export async function createShare(req, res, next) {
  try {
    const session = await Session.findById(req.params.id)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    if (session.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })

    const { password, expiresInDays } = req.body
    const share = await SharedReport.create({
      sessionId: session.id,
      userId: req.user.id,
      shareToken: nanoid(21),
      isPasswordProtected: Boolean(password),
      passwordHash: password ? await bcrypt.hash(password, 10) : null,
      expiresAt: expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null
    })
    res.status(201).json({ share })
  } catch (err) { next(err) }
}

export async function listShares(req, res, next) {
  try {
    const session = await Session.findById(req.params.id)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    if (session.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })
    res.json({ shares: await SharedReport.findBySession(session.id) })
  } catch (err) { next(err) }
}

// Public endpoint: resolves a share token into full report data.
export async function viewShared(req, res, next) {
  try {
    const share = await SharedReport.findByToken(req.params.token)
    if (!share) return res.status(404).json({ error: 'This link does not exist' })
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      return res.status(410).json({ error: 'This link has expired' })
    }
    if (share.is_password_protected) {
      const supplied = req.headers['x-share-password'] || req.query.password
      if (!supplied || !(await bcrypt.compare(supplied, share.password_hash))) {
        return res.status(401).json({ error: 'Password required', passwordRequired: true })
      }
    }

    await SharedReport.incrementViews(share.id)
    const session = await Session.findById(share.session_id)
    const [frames, empathyMoments] = await Promise.all([
      Frame.findBySession(session.id),
      EmpathyMoment.findBySession(session.id)
    ])
    const baseline = session.baseline_session_id ? await Session.findById(session.baseline_session_id) : null
    res.json({ mission: missionComparison(session, baseline?.user_id === session.user_id ? baseline : null), session, frames, empathyMoments, lookedAt: lookedAt(session, empathyMoments.length),
      noMomentsText: noMomentsText(session, empathyMoments.length), intro: SIMULATION_INTRO, snapshotNote: SNAPSHOT_NOTE })
  } catch (err) { next(err) }
}

export async function deleteShare(req, res, next) {
  try {
    const ok = await SharedReport.delete(req.params.shareId, req.user.id)
    if (!ok) return res.status(404).json({ error: 'Share not found' })
    res.json({ ok: true })
  } catch (err) { next(err) }
}
