import { query } from '../config/database.js'

export const User = {
  async create({ email, name, passwordHash }) {
    const { rows } = await query(
      `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, $3)
       RETURNING id, email, name, avatar_url, subscription_tier, team_id, created_at`,
      [email.toLowerCase(), name, passwordHash]
    )
    return rows[0]
  },

  async findByEmail(email) {
    const { rows } = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()])
    return rows[0]
  },

  async findById(id) {
    const { rows } = await query(
      'SELECT id, email, name, avatar_url, subscription_tier, team_id, created_at FROM users WHERE id = $1',
      [id]
    )
    return rows[0]
  },

  async touchActivity(id) {
    await query('UPDATE users SET last_active_at = NOW() WHERE id = $1', [id])
  },

  async setTeam(userId, teamId) {
    await query('UPDATE users SET team_id = $2 WHERE id = $1', [userId, teamId])
  }
}
