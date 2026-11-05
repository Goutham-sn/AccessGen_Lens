import { query } from './database.js'

// There is no sign-in: AccessGen Lens runs on your own machine, for you.
// Every request is made as this one local user, so sessions, reports, the
// run limits and sharing keep working exactly as they did with accounts.
const EMAIL = 'you@accessgen.local'
let localUser = null

export async function ensureLocalUser() {
  const { rows } = await query(
    `INSERT INTO users (email, name, password_hash) VALUES ($1, $2, '!')
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING id, email, name`,
    [EMAIL, 'You']
  )
  localUser = { id: rows[0].id, email: rows[0].email, name: rows[0].name }
  // Everything made while there were accounts becomes the local user's, so
  // no earlier session, report or person is locked away.
  await query('UPDATE sessions SET user_id = $1 WHERE user_id IS DISTINCT FROM $1', [localUser.id])
  await query('UPDATE personas SET user_id = $1 WHERE user_id IS NOT NULL AND user_id <> $1 AND NOT is_built_in', [localUser.id])
  return localUser
}

export function getLocalUser() {
  return localUser
}
