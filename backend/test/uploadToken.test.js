// Upload token rules, against the running backend:
//   docker compose exec backend node --test test/uploadToken.test.js
// Creates its own throwaway user and removes it (and its sessions) at the end.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import pg from 'pg'
import { removeTestUser, closeAppPool } from './cleanup.js'
import { finalizeIfStillPending } from '../src/jobs/finalizeSession.job.js'
import { hashUploadToken } from '../src/utils/uploadToken.js'
import { makeUploadRecording } from '../src/controllers/frames.controller.js'

const API = `http://localhost:${process.env.PORT || 3001}/api`
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const email = `upload-test-${Date.now()}@example.invalid`
let user
let access

async function call(path, { method = 'GET', bearer, uploadToken, json, form } = {}) {
  const headers = {}
  if (bearer) headers.Authorization = `Bearer ${bearer}`
  if (uploadToken) headers['X-Upload-Token'] = uploadToken
  let body
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json) }
  if (form) body = form
  const res = await fetch(`${API}${path}`, { method, headers, body })
  return { status: res.status, data: await res.json().catch(() => null) }
}

function videoForm() {
  const form = new FormData()
  form.append('recordingOffsetMs', '0')
  form.append('video', new Blob([Buffer.from('1a45dfa3', 'hex')], { type: 'video/webm' }), 'session.webm')
  return form
}

async function newSession() {
  const r = await call('/sessions', { method: 'POST', bearer: access, json: { url: 'https://example.com' } })
  assert.equal(r.status, 201)
  assert.equal(typeof r.data.uploadToken, 'string')
  return { id: r.data.session.id, token: r.data.uploadToken, session: r.data.session }
}

const frames = (id, opts) => call(`/sessions/${id}/frames`, { method: 'POST', json: { frames: [], events: [] }, ...opts })

before(async () => {
  const r = await call('/auth/register', { method: 'POST', json: { email, password: 'upload-test-password', name: 'Upload Test' } })
  assert.equal(r.status, 201)
  user = r.data.user
  access = r.data.accessToken
})

after(async () => {
  await removeTestUser(pool, email)
  await pool.end()
  await closeAppPool()
})

test('reading and creating sessions still needs a valid access token', async () => {
  const s = await newSession()
  assert.equal((await call('/sessions', { bearer: 'expired.or.invalid' })).status, 401)
  assert.equal((await call(`/sessions/${s.id}`, { uploadToken: s.token })).status, 401, 'the upload token cannot read')
  assert.equal((await call('/sessions', { method: 'POST', json: { url: 'https://example.com' } })).status, 401)
  assert.equal((await call(`/sessions/${s.id}`, { method: 'DELETE', uploadToken: s.token })).status, 401)
})

test('the token is returned once to the owner and only its hash is stored', async () => {
  const s = await newSession()
  assert.equal(s.session.upload_token_hash, undefined)
  const { rows } = await pool.query('SELECT * FROM sessions WHERE id = $1', [s.id])
  assert.equal(rows[0].upload_token_hash, hashUploadToken(s.token))
  assert.ok(!JSON.stringify(rows[0]).includes(s.token), 'raw token is not stored anywhere in the row')
  const read = await call(`/sessions/${s.id}`, { bearer: access })
  assert.ok(!JSON.stringify(read.data).includes(s.token))
  assert.equal(read.data.session.upload_token_hash, undefined)
})

test('no token, a wrong token, or another session token is refused', async () => {
  const a = await newSession()
  const b = await newSession()
  assert.equal((await frames(a.id)).status, 401)
  assert.equal((await frames(a.id, { uploadToken: 'not-the-token' })).status, 401)
  assert.equal((await frames(a.id, { uploadToken: b.token })).status, 401)
  assert.equal((await call(`/sessions/${a.id}/recording`, { method: 'POST', uploadToken: b.token, form: videoForm() })).status, 401)
  assert.equal((await frames(a.id, { uploadToken: a.token })).status, 200)
})

test('an unknown session, a malformed id and a bad token all get the same answer', async () => {
  const s = await newSession()
  const unknown = await frames('00000000-0000-4000-8000-000000000000', { uploadToken: s.token })
  const malformed = await frames('not-a-session', { uploadToken: s.token })
  const badToken = await frames(s.id, { uploadToken: 'not-the-token' })
  for (const r of [unknown, malformed, badToken]) {
    assert.equal(r.status, 401)
    assert.deepEqual(r.data, badToken.data)
  }
})

test('the token works after the access token has expired', async () => {
  const s = await newSession()
  const expired = jwt.sign({ sub: user.id, email }, process.env.JWT_SECRET, { expiresIn: -10 })
  assert.equal((await frames(s.id, { bearer: expired })).status, 401)
  assert.equal((await frames(s.id, { bearer: expired, uploadToken: s.token })).status, 200)
  const moment = await call(`/sessions/${s.id}/empathy-moments`, {
    method: 'POST', bearer: expired, uploadToken: s.token, json: { label: 'Lost', timestampMs: 1000 }
  })
  assert.equal(moment.status, 201)
})

test('/end closes frames and moments for the token, but not for the owner', async () => {
  const s = await newSession()
  assert.equal((await call(`/sessions/${s.id}/end`, { method: 'POST', uploadToken: s.token })).status, 200)
  assert.equal((await frames(s.id, { uploadToken: s.token })).status, 401)
  const moment = await call(`/sessions/${s.id}/empathy-moments`, {
    method: 'POST', uploadToken: s.token, json: { label: 'Late', timestampMs: 1 }
  })
  assert.equal(moment.status, 401)
  assert.equal((await frames(s.id, { bearer: access })).status, 200)
})

test('a recording upload after the 90 s finalize, inside the grace period, still lands', async () => {
  const s = await newSession()
  assert.equal((await call(`/sessions/${s.id}/end`, { method: 'POST', uploadToken: s.token })).status, 200)
  // What the delayed finalize job does 90 s after /end.
  await finalizeIfStillPending(s.id, null)
  const { rows: [finalized] } = await pool.query('SELECT status, processing_complete, video_url FROM sessions WHERE id = $1', [s.id])
  assert.equal(finalized.processing_complete, true)
  assert.equal(finalized.video_url, null)
  assert.equal(finalized.status, 'no_video')

  const up = await call(`/sessions/${s.id}/recording`, { method: 'POST', uploadToken: s.token, form: videoForm() })
  assert.equal(up.status, 201)
  const { rows: [landed] } = await pool.query('SELECT status, video_url FROM sessions WHERE id = $1', [s.id])
  assert.equal(landed.video_url, `sessions/${s.id}/session.webm`)
  assert.equal(landed.status, 'complete')
})

test('the recording token is single use', async () => {
  const s = await newSession()
  await call(`/sessions/${s.id}/end`, { method: 'POST', uploadToken: s.token })
  assert.equal((await call(`/sessions/${s.id}/recording`, { method: 'POST', uploadToken: s.token, form: videoForm() })).status, 201)
  assert.equal((await call(`/sessions/${s.id}/recording`, { method: 'POST', uploadToken: s.token, form: videoForm() })).status, 401)
})

test('the recording is refused once the 10 minute grace period after /end is over', async () => {
  const s = await newSession()
  await call(`/sessions/${s.id}/end`, { method: 'POST', uploadToken: s.token })
  await pool.query(`UPDATE sessions SET uploads_closed_at = NOW() - INTERVAL '11 minutes' WHERE id = $1`, [s.id])
  assert.equal((await call(`/sessions/${s.id}/recording`, { method: 'POST', uploadToken: s.token, form: videoForm() })).status, 401)
})

test('a recording upload that fails after the claim gives the token back, and a retry lands', async () => {
  const s = await newSession()
  await call(`/sessions/${s.id}/end`, { method: 'POST', uploadToken: s.token })

  // Same controller as the route, with storage failing after the claim.
  const failing = makeUploadRecording({ store: async () => { throw new Error('storage unavailable') } })
  let passedOn = null
  const res = { status() { return this }, json() { return this } }
  await failing({
    params: { id: s.id },
    writer: { via: 'upload-token' },
    file: { buffer: Buffer.from('1a45dfa3', 'hex'), mimetype: 'video/webm' },
    body: { recordingOffsetMs: '0' },
    app: { get: () => null }
  }, res, (err) => { passedOn = err })
  assert.equal(passedOn?.message, 'storage unavailable')

  const { rows: [afterFailure] } = await pool.query('SELECT recording_token_used, video_url FROM sessions WHERE id = $1', [s.id])
  assert.equal(afterFailure.recording_token_used, false, 'the claim was released')
  assert.equal(afterFailure.video_url, null)

  const retry = await call(`/sessions/${s.id}/recording`, { method: 'POST', uploadToken: s.token, form: videoForm() })
  assert.equal(retry.status, 201)
  const { rows: [landed] } = await pool.query('SELECT recording_token_used, video_url FROM sessions WHERE id = $1', [s.id])
  assert.equal(landed.video_url, `sessions/${s.id}/session.webm`)
  assert.equal(landed.recording_token_used, true)
})

test('repeated /end calls never extend the grace period', async () => {
  const s = await newSession()
  await call(`/sessions/${s.id}/end`, { method: 'POST', uploadToken: s.token })
  await pool.query(`UPDATE sessions SET uploads_closed_at = NOW() - INTERVAL '9 minutes' WHERE id = $1`, [s.id])
  // The owner can still call /end again; it must not move uploads_closed_at.
  assert.equal((await call(`/sessions/${s.id}/end`, { method: 'POST', bearer: access })).status, 200)
  const { rows: [r] } = await pool.query(
    `SELECT uploads_closed_at < NOW() - INTERVAL '8 minutes' AS still_old FROM sessions WHERE id = $1`, [s.id])
  assert.equal(r.still_old, true)
})

test('playback reports the upload window, decided by the database clock', async () => {
  const s = await newSession()
  const windowOf = async () => (await call(`/playback/${s.id}`, { bearer: access })).data.uploadWindow
  const live = await windowOf()
  assert.equal(live.open, true, 'still going: a recording can still arrive')
  assert.equal(live.waitUntil, null)

  await call(`/sessions/${s.id}/end`, { method: 'POST', uploadToken: s.token })
  const ended = await windowOf()
  assert.equal(ended.open, true, 'inside the grace period after /end')
  assert.ok(ended.waitUntil, 'the window has an end')

  await pool.query(`UPDATE sessions SET uploads_closed_at = NOW() - INTERVAL '11 minutes' WHERE id = $1`, [s.id])
  assert.equal((await windowOf()).open, false, 'past the grace period')
})
