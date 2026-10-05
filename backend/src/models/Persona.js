import { query } from '../config/database.js'

export const Persona = {
  async create({ userId, name, age, story, profiles, isPublic, teamId, isBuiltIn = false }) {
    const { rows } = await query(
      `INSERT INTO personas (user_id, name, age, story, profiles, is_public, team_id, is_built_in)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [userId ?? null, name, age ?? null, story ?? null, JSON.stringify(profiles || []),
       isPublic ?? false, teamId ?? null, isBuiltIn]
    )
    return rows[0]
  },

  async findVisibleTo(userId, teamId) {
    const { rows } = await query(
      `SELECT * FROM personas
       WHERE is_built_in = TRUE OR user_id = $1 OR (team_id IS NOT NULL AND team_id = $2) OR is_public = TRUE
       ORDER BY is_built_in DESC, created_at DESC`,
      [userId, teamId]
    )
    return rows
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM personas WHERE id = $1', [id])
    return rows[0]
  },

  async update(id, userId, fields) {
    const map = { name: 'name', age: 'age', story: 'story', profiles: 'profiles', isPublic: 'is_public' }
    const keys = Object.keys(fields).filter((k) => map[k] !== undefined)
    if (keys.length === 0) return this.findById(id)
    const sets = keys.map((k, i) => `${map[k]} = $${i + 3}`).join(', ')
    const vals = keys.map((k) => (k === 'profiles' ? JSON.stringify(fields[k]) : fields[k]))
    const { rows } = await query(
      `UPDATE personas SET ${sets} WHERE id = $1 AND user_id = $2 AND is_built_in = FALSE RETURNING *`,
      [id, userId, ...vals]
    )
    return rows[0]
  },

  async delete(id, userId) {
    const { rowCount } = await query(
      'DELETE FROM personas WHERE id = $1 AND user_id = $2 AND is_built_in = FALSE',
      [id, userId]
    )
    return rowCount > 0
  }
}
