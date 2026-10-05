import crypto from 'crypto'
import { query } from '../config/database.js'
import { redis } from '../config/redis.js'
import { Persona } from '../models/Persona.js'
import { runQueue } from '../jobs/queue.js'
import { RUNNER_CAPABILITIES, RUNNER_PROFILES } from '../config/runnerCapabilities.js'
import { SIMULATION_INTRO } from '../config/copy.js'
import { deleteSessionAndMedia } from '../utils/deleteSession.js'

// RUNNER_PROFILES (from config/runnerCapabilities.js) is what the runner can
// simulate. Everything else a persona has is listed in the report as not
// simulated in this run.

const MAX_PERSONAS_PER_RUN = 4
const DAILY_RUN_LIMIT = parseInt(process.env.RUNNER_DAILY_LIMIT || '20', 10)
const ACTIVE_RUN_TTL_S = 10 * 60 // safety net if the runner never releases it

// Syntax and scheme only. The real network guard is the runner's egress
// proxy, which resolves every host and refuses private addresses.
function checkUrl(raw) {
  if (typeof raw !== 'string' || raw.length > 2048) return null
  let url
  try { url = new URL(raw.trim()) } catch { return null }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  if (url.username || url.password) return null
  if (url.port && url.port !== '80' && url.port !== '443') return null
  url.hash = ''
  return url.toString()
}

function canUsePersona(persona, userId) {
  return persona && (persona.is_built_in || persona.is_public || persona.user_id === userId)
}

export async function createRun(req, res, next) {
  try {
    const url = checkUrl(req.body?.url)
    if (!url) {
      return res.status(400).json({ error: 'Enter a public web address that starts with http:// or https://.' })
    }

    const ids = Array.isArray(req.body?.personaIds) ? [...new Set(req.body.personaIds)] : []
    if (ids.length === 0 || ids.length > MAX_PERSONAS_PER_RUN) {
      return res.status(400).json({ error: `Choose between 1 and ${MAX_PERSONAS_PER_RUN} people.` })
    }

    const personas = []
    for (const id of ids) {
      const persona = await Persona.findById(id).catch(() => null)
      if (!canUsePersona(persona, req.user.id)) {
        return res.status(404).json({ error: 'One of the chosen people could not be found.' })
      }
      const profiles = Array.isArray(persona.profiles) ? persona.profiles : []
      const supported = profiles.filter((p) => RUNNER_PROFILES.has(p.id))
      if (supported.length === 0) {
        return res.status(400).json({
          error: `Watch it happen does not cover ${persona.name}'s experience yet. Explore it yourself instead.`
        })
      }
      personas.push({ persona, supported, notSimulated: profiles.filter((p) => !RUNNER_PROFILES.has(p.id)) })
    }

    // Per-user limits: one active run at a time, and a daily cap.
    const runId = crypto.randomUUID()
    const activeKey = `runs:active:${req.user.id}`
    const gotSlot = await redis.set(activeKey, runId, 'EX', ACTIVE_RUN_TTL_S, 'NX')
    if (!gotSlot) {
      return res.status(429).json({ error: 'A run is already in progress. Please wait for it to finish.' })
    }
    const dayKey = `runs:day:${req.user.id}:${new Date().toISOString().slice(0, 10)}`
    const today = await redis.incr(dayKey)
    if (today === 1) await redis.expire(dayKey, 24 * 60 * 60)
    if (today > DAILY_RUN_LIMIT) {
      await redis.del(activeKey)
      return res.status(429).json({ error: 'That is all the runs for today. Please try again tomorrow.' })
    }

    const sessions = []
    for (const { persona, supported, notSimulated } of personas) {
      const { rows } = await query(
        `INSERT INTO sessions (user_id, url, active_profiles, persona_id, persona_snapshot,
                               start_time, status, source, run_id, coverage)
         VALUES ($1, $2, $3, $4, $5, NOW(), 'queued', 'runner', $6, $7)
         RETURNING id`,
        [req.user.id, url, JSON.stringify(supported), persona.id,
         JSON.stringify({ id: persona.id, name: persona.name, age: persona.age, story: persona.story, profiles: persona.profiles }),
         runId, JSON.stringify({ notSimulated: notSimulated.map((p) => p.id) })]
      )
      sessions.push({
        sessionId: rows[0].id,
        persona: { id: persona.id, name: persona.name },
        profiles: supported.map((p) => ({ id: p.id, severity: p.severity ?? 2 }))
      })
    }

    await runQueue.add({ runId, userId: req.user.id, url, sessions }, { timeout: 10 * 60 * 1000 })

    res.status(201).json({
      runId,
      sessions: sessions.map((s) => ({ id: s.sessionId, personaName: s.persona.name }))
    })
  } catch (err) { next(err) }
}

// What the /start page needs: the shared intro, and what the runner can do
// today, so a card never claims a check that is not running.
export function getCapabilities(req, res) {
  res.json({ intro: SIMULATION_INTRO, capabilities: RUNNER_CAPABILITIES })
}

// Deletes every session of a run (one per persona) and everything each one
// stored. Refused while any of them is still running.
export async function deleteRun(req, res, next) {
  try {
    const { rows } = await query(
      'SELECT id, processing_complete FROM sessions WHERE run_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Run not found' })
    if (rows.some((r) => !r.processing_complete)) {
      return res.status(409).json({ error: 'This run is still going. Please wait for it to finish before deleting it.' })
    }
    let removedObjects = 0
    for (const r of rows) removedObjects += (await deleteSessionAndMedia(r.id)).removed
    res.json({ ok: true, sessions: rows.length, removedObjects })
  } catch (err) { next(err) }
}

export async function getRun(req, res, next) {
  try {
    const { rows } = await query(
      `SELECT id, url, status, persona_snapshot, video_url, coverage, run_timings, processing_complete
         FROM sessions WHERE run_id = $1 AND user_id = $2 ORDER BY created_at ASC`,
      [req.params.id, req.user.id]
    )
    if (rows.length === 0) return res.status(404).json({ error: 'Run not found' })
    res.json({
      runId: req.params.id,
      url: rows[0].url,
      sessions: rows.map((r) => ({
        id: r.id,
        status: r.status,
        personaName: r.persona_snapshot?.name || null,
        hasVideo: Boolean(r.video_url),
        complete: r.processing_complete,
        coverage: r.coverage,
        timings: r.run_timings
      }))
    })
  } catch (err) { next(err) }
}
