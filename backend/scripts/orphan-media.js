// Finds stored objects whose session no longer exists, left behind by
// deletes made before objects were removed with their session.
//
//   docker compose exec backend node scripts/orphan-media.js           (list only)
//   docker compose exec backend node scripts/orphan-media.js --apply
//
// Only folders under sessions/ whose session row is gone AND whose newest
// object is more than an hour old are counted, so nothing being written
// right now is touched.
//
// With --apply:
//   - folders where every object is empty are deleted. Empty means 0 bytes,
//     or exactly the 4-byte placeholder the upload tests send (the first four
//     bytes of a WebM header, 1a45dfa3, with no video after them);
//   - folders holding any data are moved, not deleted: each object is copied
//     to quarantine/sessions/<id>/..., the copy's size is checked, and only
//     then is the original removed. Nothing in quarantine/ is ever deleted by
//     this script.
import pg from 'pg'
import * as Minio from 'minio'
import { minioClient, BUCKET } from '../src/config/storage.js'
import { removeKeys } from '../src/utils/storage.js'

const MIN_AGE_MS = 60 * 60 * 1000
const QUARANTINE = 'quarantine/'
const apply = process.argv.includes('--apply')

const folders = new Map() // session id -> { objects: [{ key, size }], newest, bytes }
for await (const obj of minioClient.listObjectsV2(BUCKET, 'sessions/', true)) {
  const id = obj.name.split('/')[1]
  if (!id) continue
  const f = folders.get(id) || { objects: [], newest: 0, bytes: 0 }
  f.objects.push({ key: obj.name, size: obj.size || 0 })
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
const TEST_PLACEHOLDER = '1a45dfa3'
async function isEmpty(o) {
  if (o.size === 0) return true
  if (o.size !== TEST_PLACEHOLDER.length / 2) return false
  const chunks = []
  for await (const c of await minioClient.getObject(BUCKET, o.key)) chunks.push(c)
  return Buffer.concat(chunks).toString('hex') === TEST_PLACEHOLDER
}
const empty = []
const withData = []
for (const entry of orphans) {
  let all = true
  for (const o of entry[1].objects) if (!(await isEmpty(o))) { all = false; break }
  ;(all ? empty : withData).push(entry)
}

const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`
const when = (ms) => new Date(ms).toISOString()

console.log(`Session folders: ${folders.size}. With no session row and older than an hour: ${orphans.length}.`)
if (tooNew.length) console.log(`Skipped (no session row, but changed within the last hour): ${tooNew.length}.`)

console.log(`\nEmpty (0 bytes, or only the 4-byte test placeholder), to delete: ${empty.length}`)
for (const [id, f] of empty) {
  console.log(`  sessions/${id}/  ${f.bytes} bytes, last changed ${when(f.newest)}, ${f.objects.map((o) => o.key.slice(`sessions/${id}/`.length)).join(', ')}`)
}

console.log(`\nHolding data, to move to ${QUARANTINE}: ${withData.length}`)
for (const [id, f] of withData) {
  console.log(`  sessions/${id}/  ${kb(f.bytes)}, last changed ${when(f.newest)}`)
  for (const o of f.objects) console.log(`      ${o.key.slice(`sessions/${id}/`.length)}  ${kb(o.size)}`)
}

if (!apply) {
  console.log('\nList only. Run again with --apply to delete the empty folders and move the others.')
} else {
  const removed = await removeKeys(empty.flatMap(([, f]) => f.objects.map((o) => o.key)))
  console.log(`\nDeleted ${removed} empty object(s).`)

  let moved = 0
  for (const [, f] of withData) {
    for (const o of f.objects) {
      const target = QUARANTINE + o.key
      await minioClient.copyObject(BUCKET, target, `/${BUCKET}/${o.key}`, new Minio.CopyConditions())
      const stat = await minioClient.statObject(BUCKET, target)
      if (stat.size !== o.size) {
        throw new Error(`copy of ${o.key} is ${stat.size} bytes, expected ${o.size}; original kept`)
      }
      await removeKeys([o.key])
      moved++
    }
  }
  console.log(`Moved ${moved} object(s) to ${QUARANTINE}.`)
}
