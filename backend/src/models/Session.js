import { query } from '../config/database.js'
import { RECORDING_GRACE_MINUTES } from '../utils/uploadToken.js'

// run_debug (dropped runner findings) and the upload token columns are
// internal and must never leave the server, so every row is cleaned on its
// way out.
function clean(row) {
  if (!row) return row
  const {
    run_debug, upload_token_hash, upload_token_expires_at, uploads_closed_at, recording_token_used,
    ...rest
  } = row
  return rest
}

export const Session = {
  async create({ userId, url, pageTitle, activeProfiles, personaId, personaSnapshot }) {
    const { rows } = await query(
      `INSERT INTO sessions (user_id, url, page_title, active_profiles, persona_id, persona_snapshot, start_time, status)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), 'recording')
       RETURNING *`,
      [userId, url, pageTitle || null, JSON.stringify(activeProfiles || []), personaId || null,
       personaSnapshot ? JSON.stringify(personaSnapshot) : null]
    )
    return clean(rows[0])
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM sessions WHERE id = $1', [id])
    return clean(rows[0])
  },

  async findByUser(userId, { limit = 50, offset = 0 } = {}) {
    const { rows } = await query(
      `SELECT * FROM sessions WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    )
    return rows.map(clean)
  },

  async end(id) {
    const { rows } = await query(
      `UPDATE sessions
       SET end_time = NOW(),
           duration_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))::int,
           status = 'processing'
       WHERE id = $1 RETURNING *`,
      [id]
    )
    return clean(rows[0])
  },

  // Store a new upload token's hash (never the token itself).
  async setUploadToken(id, hash, ttlHours) {
    await query(
      `UPDATE sessions
          SET upload_token_hash = $2,
              upload_token_expires_at = NOW() + make_interval(hours => $3),
              uploads_closed_at = NULL,
              recording_token_used = FALSE
        WHERE id = $1`,
      [id, hash, ttlHours]
    )
  },

  // What the upload middleware needs, with the time checks done by the
  // database clock so the app server's clock and timezone do not matter.
  async findUploadAuth(id, graceMinutes = RECORDING_GRACE_MINUTES) {
    const { rows } = await query(
      `SELECT user_id, upload_token_hash, recording_token_used,
              (upload_token_expires_at IS NOT NULL AND NOW() < upload_token_expires_at) AS token_live,
              (uploads_closed_at IS NOT NULL) AS uploads_closed,
              (uploads_closed_at IS NULL OR NOW() < uploads_closed_at + make_interval(mins => $2)) AS recording_window_open
         FROM sessions WHERE id = $1`,
      [id, graceMinutes]
    )
    return rows[0]
  },

  // Whether a recording can still arrive, by the database clock, so the
  // browser's clock never decides it. Extension sessions: until the grace
  // period after uploads closed (or after end_time for older sessions).
  // Runner sessions: until the run is finished, since the runner uploads
  // before it finishes.
  async uploadWindow(id, graceMinutes = RECORDING_GRACE_MINUTES) {
    const { rows } = await query(
      `SELECT
         CASE
           WHEN video_url IS NOT NULL THEN FALSE
           WHEN source = 'runner' THEN NOT COALESCE(processing_complete, FALSE)
           WHEN COALESCE(uploads_closed_at, end_time) IS NULL THEN TRUE
           ELSE NOW() < COALESCE(uploads_closed_at, end_time) + make_interval(mins => $2)
         END AS recording_window_open,
         CASE
           WHEN source = 'runner' OR COALESCE(uploads_closed_at, end_time) IS NULL THEN NULL
           ELSE COALESCE(uploads_closed_at, end_time) + make_interval(mins => $2)
         END AS wait_until
         FROM sessions WHERE id = $1`,
      [id, graceMinutes]
    )
    return rows[0] ? { open: rows[0].recording_window_open, waitUntil: rows[0].wait_until } : null
  },

  // /end: frames and moments stop being accepted with the upload token. The
  // recording keeps its grace period, counted from this moment.
  async closeUploads(id) {
    await query('UPDATE sessions SET uploads_closed_at = COALESCE(uploads_closed_at, NOW()) WHERE id = $1', [id])
  },

  // Single use: true for exactly one caller.
  async claimRecordingToken(id) {
    const { rowCount } = await query(
      'UPDATE sessions SET recording_token_used = TRUE WHERE id = $1 AND recording_token_used = FALSE',
      [id]
    )
    return rowCount === 1
  },

  // Give the claim back if storing the video failed, so the extension can retry.
  async releaseRecordingToken(id) {
    await query('UPDATE sessions SET recording_token_used = FALSE WHERE id = $1', [id])
  },

  async update(id, fields) {
    const keys = Object.keys(fields)
    if (keys.length === 0) return this.findById(id)
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ')
    const { rows } = await query(
      `UPDATE sessions SET ${sets} WHERE id = $1 RETURNING *`,
      [id, ...keys.map((k) => fields[k])]
    )
    return clean(rows[0])
  },

  async incrementCounts(id, { frames = 0, events = 0, moments = 0 }) {
    await query(
      `UPDATE sessions SET frame_count = frame_count + $2,
        event_count = event_count + $3,
        empathy_moment_count = empathy_moment_count + $4
       WHERE id = $1`,
      [id, frames, events, moments]
    )
  },

  // Every stored object a session's rows point at: the video, frames, the
  // report PDF and every moment picture (shot, clean, close-up, persona
  // view, and the extension's screenshot). Used on delete as a safety net
  // for anything stored outside the session's own prefix.
  async mediaKeys(id) {
    const { rows } = await query(
      `SELECT video_url AS key FROM sessions WHERE id = $1
       UNION SELECT screenshot_url FROM session_frames WHERE session_id = $1
       UNION SELECT unnest(ARRAY[screenshot_url, shot_url, shot_clean_url, closeup_url, shot_persona_url])
             FROM empathy_moments WHERE session_id = $1`,
      [id]
    )
    return rows.map((r) => r.key).filter(Boolean)
  },

  async delete(id) {
    await query('DELETE FROM sessions WHERE id = $1', [id])
  }
}
