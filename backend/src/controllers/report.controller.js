import { Session } from '../models/Session.js'
import { SIMULATION_INTRO } from '../config/copy.js'
import { Frame } from '../models/Frame.js'
import { Event } from '../models/Event.js'
import { EmpathyMoment } from '../models/EmpathyMoment.js'
import { enqueueReportGeneration } from '../jobs/queue.js'
import { getObjectBuffer } from '../utils/storage.js'
import { lookedAt } from '../utils/lookedAt.js'

const LABEL_PHRASES = {
  'Got completely stuck here': 'came to a complete stop',
  'Could not find this': 'searched without success',
  'Would have given up': 'reached the point of giving up',
  'This took too long': 'spent far longer than it should take',
  'This makes no sense': 'was left confused',
  'I felt excluded': 'felt shut out of the experience'
}

function buildHumanSummary(session, moments) {
  const persona = session.persona_snapshot
  const who = persona?.name || 'The visitor'
  const minutes = Math.max(1, Math.round((session.duration_seconds || 0) / 60))
  const profiles = (session.active_profiles || []).map((p) => p.name || p.id).join(', ')

  const paras = []
  paras.push(
    `${who} spent ${minutes} minute${minutes === 1 ? '' : 's'} on ${session.url}, experiencing it with ${profiles || 'the selected profiles'}. ` +
    (persona?.story ? persona.story : `Every interaction happened exactly as it would for a real person living with these conditions.`)
  )

  if (moments.length > 0) {
    const phrases = moments.slice(0, 3).map((m) =>
      `${who} ${LABEL_PHRASES[m.label] || 'struggled'}${m.note ? ` — "${m.note}"` : ''}`
    )
    paras.push(
      `There were ${moments.length} moment${moments.length === 1 ? '' : 's'} where the experience broke down. ` +
      phrases.join('. ') + '.'
    )
  } else {
    // Never an all-clear: for a run, say what was done and how little we look at.
    paras.push(lookedAt(session, 0)?.zeroMoments || 'No moments were flagged during this session.')
  }

  paras.push(
    `None of this is about compliance. It is about whether ${who === 'The visitor' ? 'someone' : who} ` +
    `can do what they came to do. Watch the recording below and feel the moments where the page pushed back.`
  )
  return paras
}

export async function getReport(req, res, next) {
  try {
    const session = await Session.findById(req.params.id)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    if (session.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })

    const [frames, events, empathyMoments] = await Promise.all([
      Frame.findBySession(session.id),
      Event.findBySession(session.id),
      EmpathyMoment.findBySession(session.id)
    ])

    res.json({
      session,
      frames,
      events,
      empathyMoments,
      humanSummary: buildHumanSummary(session, empathyMoments),
      lookedAt: lookedAt(session, empathyMoments.length),
      intro: SIMULATION_INTRO
    })
  } catch (err) { next(err) }
}

export async function requestPdf(req, res, next) {
  try {
    const session = await Session.findById(req.params.id)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    if (session.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })

    await enqueueReportGeneration(session.id)
    res.status(202).json({ status: 'queued', pdfKey: `sessions/${session.id}/report.pdf` })
  } catch (err) { next(err) }
}

export async function downloadPdf(req, res, next) {
  try {
    const session = await Session.findById(req.params.id)
    if (!session) return res.status(404).json({ error: 'Session not found' })
    if (session.user_id !== req.user.id) return res.status(403).json({ error: 'Forbidden' })

    const buffer = await getObjectBuffer(`sessions/${session.id}/report.pdf`).catch(() => null)
    if (!buffer) return res.status(404).json({ error: 'PDF not ready yet' })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="empathy-report-${session.id}.pdf"`)
    res.send(buffer)
  } catch (err) { next(err) }
}
