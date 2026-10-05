import { query } from '../config/database.js'

export const Frame = {
  async insertMany(records) {
    if (records.length === 0) return []
    const cols = ['session_id', 'frame_index', 'timestamp_ms', 'screenshot_url',
      'scroll_x', 'scroll_y', 'focused_element', 'active_profiles', 'cognitive_load_score']
    const values = []
    const placeholders = records.map((r, i) => {
      const base = i * cols.length
      values.push(
        r.session_id, r.frame_index, r.timestamp_ms, r.screenshot_url,
        r.scroll_x ?? 0, r.scroll_y ?? 0,
        r.focused_element ? JSON.stringify(r.focused_element) : null,
        r.active_profiles ? JSON.stringify(r.active_profiles) : null,
        r.cognitive_load_score ?? null
      )
      return `(${cols.map((_, j) => `$${base + j + 1}`).join(', ')})`
    })
    const { rows } = await query(
      `INSERT INTO session_frames (${cols.join(', ')}) VALUES ${placeholders.join(', ')} RETURNING id`,
      values
    )
    return rows
  },

  async findBySession(sessionId) {
    const { rows } = await query(
      'SELECT * FROM session_frames WHERE session_id = $1 ORDER BY frame_index ASC',
      [sessionId]
    )
    return rows
  }
}
