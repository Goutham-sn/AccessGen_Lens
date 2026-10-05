import { query } from '../config/database.js'

export const SharedReport = {
  async create({ sessionId, userId, shareToken, isPasswordProtected, passwordHash, expiresAt }) {
    const { rows } = await query(
      `INSERT INTO shared_reports (session_id, user_id, share_token, is_password_protected, password_hash, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [sessionId, userId, shareToken, isPasswordProtected ?? false, passwordHash ?? null, expiresAt ?? null]
    )
    return rows[0]
  },

  async findByToken(token) {
    const { rows } = await query('SELECT * FROM shared_reports WHERE share_token = $1', [token])
    return rows[0]
  },

  async findBySession(sessionId) {
    const { rows } = await query(
      'SELECT * FROM shared_reports WHERE session_id = $1 ORDER BY created_at DESC',
      [sessionId]
    )
    return rows
  },

  async incrementViews(id) {
    await query('UPDATE shared_reports SET view_count = view_count + 1 WHERE id = $1', [id])
  },

  async delete(id, userId) {
    const { rowCount } = await query(
      'DELETE FROM shared_reports WHERE id = $1 AND user_id = $2', [id, userId]
    )
    return rowCount > 0
  }
}
