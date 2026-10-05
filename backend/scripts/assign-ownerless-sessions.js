// One-off: give every session that has no owner (user_id IS NULL) to one
// user. Not a migration; run it by hand once.
//
//   docker compose exec backend node scripts/assign-ownerless-sessions.js <userId>          (dry run)
//   docker compose exec backend node scripts/assign-ownerless-sessions.js <userId> --apply  (writes)
import pg from 'pg'

const [userId, flag] = process.argv.slice(2)
const apply = flag === '--apply'

if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId || '')) {
  console.error('Usage: node scripts/assign-ownerless-sessions.js <userId> [--apply]')
  process.exit(1)
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
try {
  const { rows: users } = await pool.query('SELECT id, email FROM users WHERE id = $1', [userId])
  if (users.length === 0) {
    console.error(`No user with id ${userId}.`)
    process.exit(1)
  }

  const { rows } = await pool.query(
    'SELECT id, url, status, created_at FROM sessions WHERE user_id IS NULL ORDER BY created_at'
  )
  console.log(`${rows.length} session(s) with no owner:`)
  for (const r of rows) console.log(`  ${r.id}  ${r.status.padEnd(10)}  ${r.created_at.toISOString()}  ${r.url}`)

  if (!apply) {
    console.log(`\nDry run. Add --apply to give these to ${users[0].email}.`)
  } else {
    const { rowCount } = await pool.query('UPDATE sessions SET user_id = $1 WHERE user_id IS NULL', [userId])
    console.log(`\nAssigned ${rowCount} session(s) to ${users[0].email}.`)
  }
} finally {
  await pool.end()
}
