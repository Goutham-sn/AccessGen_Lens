// Finds stored objects whose session no longer exists, left behind by
// deletes made before objects were removed with their session.
//
//   docker compose exec backend node scripts/orphan-media.js           (list only)
//   docker compose exec backend node scripts/orphan-media.js --apply   (delete)
//
// Only folders under sessions/ whose session row is gone AND whose newest
// object is more than an hour old are counted, so nothing being written
// right now is touched.
import pg from 'pg'
import { minioClient, BUCKET } from '../src/config/storage.js'
import { removeKeys } from '../src/utils/storage.js'

const MIN_AGE_MS = 60 * 60 * 1000
const apply = process.argv.includes('--apply')

const folders = new Map() // session id -> { keys, newest, bytes }
for await (const obj of minioClient.listObjectsV2(BUCKET, 'sessions/', true)) {
  const id = obj.name.split('/')[1]
  if (!id) continue
  const f = folders.get(id) || { keys: [], newest: 0, bytes: 0 }
  f.keys.push(obj.name)
  f.newest = Math.max(f.newest, new Date(obj.lastModified).getTime())
  f.bytes += obj.size || 0
  folders.set(id, f)
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const { rows } = await pool.query('SELECT id::text FROM sessions')
await pool.end()
const live = new Set(rows.map((r) => r.id))

const now = Date.now()
const orphans = [...folders.entries()]
  .filter(([id, f]) => !live.has(id) && now - f.newest > MIN_AGE_MS)
  .sort((a, b) => a[1].newest - b[1].newest)
const tooNew = [...folders.entries()].filter(([id, f]) => !live.has(id) && now - f.newest <= MIN_AGE_MS)

console.log(`Session folders: ${folders.size}. With no session row and older than an hour: ${orphans.length}.`)
if (tooNew.length) console.log(`Skipped (no session row, but changed within the last hour): ${tooNew.length}.`)
for (const [id, f] of orphans) {
  console.log(`  sessions/${id}/  ${f.keys.length} object(s), ${(f.bytes / 1024).toFixed(1)} KB, last changed ${new Date(f.newest).toISOString()}`)
}

if (!apply) {
  console.log('\nList only. Run again with --apply to delete these.')
} else {
  const removed = await removeKeys(orphans.flatMap(([, f]) => f.keys))
  console.log(`\nDeleted ${removed} object(s).`)
}
