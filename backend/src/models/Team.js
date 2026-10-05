import { query } from '../config/database.js'

export const Team = {
  async create({ name, ownerId }) {
    const { rows } = await query(
      'INSERT INTO teams (name, owner_id) VALUES ($1, $2) RETURNING *',
      [name, ownerId]
    )
    await query(
      `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, 'owner')`,
      [rows[0].id, ownerId]
    )
    return rows[0]
  },

  async findById(id) {
    const { rows } = await query('SELECT * FROM teams WHERE id = $1', [id])
    return rows[0]
  },

  async findByUser(userId) {
    const { rows } = await query(
      `SELECT t.*, tm.role FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = $1`,
      [userId]
    )
    return rows
  },

  async members(teamId) {
    const { rows } = await query(
      `SELECT u.id, u.email, u.name, u.avatar_url, tm.role, tm.joined_at
       FROM team_members tm JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = $1 ORDER BY tm.joined_at ASC`,
      [teamId]
    )
    return rows
  },

  async addMember(teamId, userId, role = 'member') {
    const { rows } = await query(
      `INSERT INTO team_members (team_id, user_id, role) VALUES ($1, $2, $3)
       ON CONFLICT (team_id, user_id) DO NOTHING RETURNING *`,
      [teamId, userId, role]
    )
    return rows[0]
  },

  async removeMember(teamId, userId) {
    await query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId])
  }
}
