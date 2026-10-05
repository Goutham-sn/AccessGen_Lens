import { query } from '../config/database.js'

export const EmpathyMoment = {
  async create({ sessionId, timestampMs, frameIndex, label, note, screenshotUrl, activeProfiles }) {
    const { rows } = await query(
      `INSERT INTO empathy_moments (session_id, timestamp_ms, frame_index, label, note, screenshot_url, active_profiles)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [sessionId, timestampMs, frameIndex ?? null, label, note ?? null, screenshotUrl ?? null,
       activeProfiles ? JSON.stringify(activeProfiles) : null]
    )
    return rows[0]
  },

  async findBySession(sessionId) {
    const { rows } = await query(
      'SELECT * FROM empathy_moments WHERE session_id = $1 ORDER BY timestamp_ms ASC',
      [sessionId]
    )
    // internal_ref is stored for us, never shown to anyone.
    return rows.map(({ internal_ref, ...rest }) => rest)
  }
}
