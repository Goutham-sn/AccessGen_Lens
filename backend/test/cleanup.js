// Test cleanup: removes a throwaway user's sessions through the same path
// the app uses (objects first, then rows), then the user. Deleting the user
// alone would leave every object the sessions stored in MinIO.
import { deleteSessionAndMedia } from '../src/utils/deleteSession.js'
import { pool as appPool } from '../src/config/database.js'

export async function removeTestUser(pool, email) {
  const { rows } = await pool.query(
    'SELECT s.id FROM sessions s JOIN users u ON u.id = s.user_id WHERE u.email = $1', [email])
  for (const r of rows) await deleteSessionAndMedia(r.id)
  await pool.query('DELETE FROM users WHERE email = $1', [email])
}

// The app's own pool, opened by deleteSessionAndMedia; closed so the test
// process can exit.
export async function closeAppPool() {
  await appPool.end().catch(() => {})
}
