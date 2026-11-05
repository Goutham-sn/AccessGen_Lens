import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Storage is not touched by these helpers, but the module imports it.
process.env.MINIO_ACCESS_KEY ||= 'test'
process.env.MINIO_SECRET_KEY ||= 'test'
const { concatList, jpegSize } = await import('../src/utils/frameVideo.js')

test('each frame is held until the next one, the last until the session ended', () => {
  const list = concatList([{ timestamp_ms: 800 }, { timestamp_ms: 1500 }, { timestamp_ms: 2900 }], 4000)
  assert.equal(list, [
    "file 'f000000.jpg'", 'duration 0.700',
    "file 'f000001.jpg'", 'duration 1.400',
    "file 'f000002.jpg'", 'duration 1.100',
    "file 'f000002.jpg'", ''
  ].join('\n'))
})

test('a long gap (tab hidden, worker asleep) is never held for more than 5 seconds', () => {
  const list = concatList([{ timestamp_ms: 0 }, { timestamp_ms: 60000 }], 61000)
  assert.match(list, /duration 5\.000/)
})

test('jpegSize reads width and height from a real JPEG', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'jpeg-'))
  const out = path.join(dir, 'x.jpg')
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=320x124', '-frames:v', '1', out])
  if (r.error || r.status !== 0) return t.skip('ffmpeg not available')
  assert.deepEqual(jpegSize(fs.readFileSync(out)), { width: 320, height: 124 })
  fs.rmSync(dir, { recursive: true, force: true })
})
