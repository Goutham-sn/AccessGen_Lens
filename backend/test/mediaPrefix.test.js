// /api/media serves session media only, never quarantine/ or anything else:
//   docker compose exec backend node --test test/mediaPrefix.test.js
// Stores two throwaway objects and removes them at the end.
import { test, after } from 'node:test'
import assert from 'node:assert/strict'
import { putBuffer, removeKeys } from '../src/utils/storage.js'

const API = `http://localhost:${process.env.PORT || 3001}/api`
const stamp = Date.now()
const sessionKey = `sessions/media-prefix-test-${stamp}/moments/01-shot.jpg`
const quarantineKey = `quarantine/sessions/media-prefix-test-${stamp}/session.webm`
const otherKey = `elsewhere/media-prefix-test-${stamp}.jpg`
const jpg = Buffer.from('ffd8ffe0', 'hex')

after(async () => { await removeKeys([sessionKey, quarantineKey, otherKey]) })

test('session media is served', async () => {
  await putBuffer(sessionKey, jpg, 'image/jpeg')
  const res = await fetch(`${API}/media/${sessionKey}`)
  assert.equal(res.status, 200)
})

test('quarantine/ is never served, even when the object exists', async () => {
  await putBuffer(quarantineKey, Buffer.from('1a45dfa3', 'hex'), 'video/webm')
  const res = await fetch(`${API}/media/${quarantineKey}`)
  assert.equal(res.status, 404)
})

test('no other prefix is served either', async () => {
  await putBuffer(otherKey, jpg, 'image/jpeg')
  const res = await fetch(`${API}/media/${otherKey}`)
  assert.equal(res.status, 404)
})
