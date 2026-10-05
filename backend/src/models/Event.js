import { query } from '../config/database.js'

export const Event = {
  async insertMany(records) {
    if (records.length === 0) return []
    const cols = ['session_id', 'timestamp_ms', 'event_type', 'target_element',
      'coordinates', 'key_pressed', 'is_empathy_moment', 'empathy_label', 'empathy_note']
    const values = []
    const placeholders = records.map((r, i) => {
      const base = i * cols.length
      values.push(
        r.session_id, r.timestamp_ms, r.event_type,
        r.target_element ? JSON.stringify(r.target_element) : null,
        r.coordinates ? JSON.stringify(r.coordinates) : null,
        r.key_pressed ?? null,
        r.is_empathy_moment ?? false,
        r.empathy_label ?? null,
        r.empathy_note ?? null
      )
      return `(${cols.map((_, j) => `$${base + j + 1}`).join(', ')})`
    })
    const { rows } = await query(
      `INSERT INTO session_events (${cols.join(', ')}) VALUES ${placeholders.join(', ')} RETURNING id`,
      values
    )
    return rows
  },

  async findBySession(sessionId) {
    const { rows } = await query(
      'SELECT * FROM session_events WHERE session_id = $1 ORDER BY timestamp_ms ASC',
      [sessionId]
    )
    return rows
  }
}
