// Deleting a session or a run removes every object it stored:
//   docker compose exec backend node --test test/deleteMedia.test.js
// Creates its own throwaway user and removes it at the end.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import pg from 'pg'
import { removeTestUser, closeAppPool } from './cleanup.js'
import { putBuffer, listKeys, statObject } from '../src/utils/storage.js'

const API = `http://localhost:${process.env.PORT || 3001}/api`
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
const email = `delete-test-${Date.now()}@example.invalid`
let user
let access

async function call(path, { method = 'GET', bearer = access, json } = {}) {
  const headers = { Authorization: `Bearer ${bearer}` }
  let body
  if (json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(json) }
  const res = await fetch(`${API}${path}`, { method, headers, body })
  return { status: res.status, data: await res.json().catch(() => null) }
}

const jpg = Buffer.from('ffd8ffe0', 'hex')
const exists = (key) => statObject(key).then(() => true, () => false)

// Everything a session can store, the way each part stores it.
async function fillSession(id) {
  const keys = {
    video: `sessions/${id}/session.webm`,
    frame: `sessions/${id}/frames/000001.jpg`,
    pdf: `sessions/${id}/report.pdf`,
    remuxTemp: `sessions/${id}/session.remux.webm`,
    remuxOriginal: `sessions/${id}/session.original.webm`,
    shot: `sessions/${id}/moments/01-shot.jpg`,
    clean: `sessions/${id}/moments/01-clean.jpg`,
    closeup: `sessions/${id}/moments/01-closeup.jpg`,
    persona: `sessions/${id}/moments/01-persona.jpg`,
    // Pointed at by a row but stored outside the session's own prefix.
    outside: `legacy/${id}-moment.jpg`
  }
  for (const k of Object.values(keys)) await putBuffer(k, jpg, 'image/jpeg')
  await pool.query('UPDATE sessions SET video_url = $2 WHERE id = $1', [id, keys.video])
  await pool.query(
    `INSERT INTO session_frames (session_id, frame_index, timestamp_ms, screenshot_url) VALUES ($1, 1, 0, $2)`,
    [id, keys.frame])
  await pool.query(
    `INSERT INTO empathy_moments (session_id, timestamp_ms, label, screenshot_url, shot_url, shot_clean_url, closeup_url, shot_persona_url)
     VALUES ($1, 0, 'x', $2, $3, $4, $5, $6)`,
    [id, keys.outside, keys.shot, keys.clean, keys.closeup, keys.persona])
  return keys
}

async function assertAllGone(id, keys) {
  assert.deepEqual(await listKeys(`sessions/${id}/`), [], 'nothing left under the session prefix')
  for (const [name, key] of Object.entries(keys)) assert.equal(await exists(key), false, `${name} removed`)
  const { rows } = await pool.query('SELECT 1 FROM sessions WHERE id = $1', [id])
  assert.equal(rows.length, 0, 'session row removed')
  const moments = await pool.query('SELECT 1 FROM empathy_moments WHERE session_id = $1', [id])
  assert.equal(moments.rows.length, 0, 'moment rows removed')
}

async function runnerSession(runId, complete) {
  const { rows } = await pool.query(
    `INSERT INTO sessions (user_id, url, start_time, status, source, run_id, processing_complete)
     VALUES ($1, 'https://example.com', NOW(), $2, 'runner', $3, $4) RETURNING id`,
    [user.id, complete ? 'complete' : 'running', runId, complete])
  return rows[0].id
}

before(async () => {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'delete-test-password', name: 'Delete Test' })
  })
  const data = await res.json()
  user = data.user
  access = data.accessToken
})

after(async () => {
  await removeTestUser(pool, email)
  await pool.end()
  await closeAppPool()
})

test('deleting a session removes its video, frames, every moment picture, the PDF and remux keys', async () => {
  const created = await call('/sessions', { method: 'POST', json: { url: 'https://example.com' } })
  const id = created.data.session.id
  const keys = await fillSession(id)
  const res = await call(`/sessions/${id}`, { method: 'DELETE' })
  assert.equal(res.status, 200)
  assert.ok(res.data.removedObjects >= Object.keys(keys).length)
  await assertAllGone(id, keys)
})

test('a run still going cannot be deleted, as a run or as one of its sessions', async () => {
  const runId = crypto.randomUUID()
  const live = await runnerSession(runId, false)
  assert.equal((await call(`/runs/${runId}`, { method: 'DELETE' })).status, 409)
  assert.equal((await call(`/sessions/${live}`, { method: 'DELETE' })).status, 409)
  await pool.query('DELETE FROM sessions WHERE id = $1', [live])
})

test('deleting a run removes every session of it and everything they stored', async () => {
  const runId = crypto.randomUUID()
  const ids = [await runnerSession(runId, true), await runnerSession(runId, true)]
  const all = []
  for (const id of ids) all.push([id, await fillSession(id)])
  const res = await call(`/runs/${runId}`, { method: 'DELETE' })
  assert.equal(res.status, 200)
  assert.equal(res.data.sessions, 2)
  for (const [id, keys] of all) await assertAllGone(id, keys)
})

test('someone else cannot delete your run', async () => {
  const runId = crypto.randomUUID()
  const id = await runnerSession(runId, true)
  const other = await fetch(`${API}/auth/register`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `delete-other-${Date.now()}@example.invalid`, password: 'delete-test-password' })
  }).then((r) => r.json())
  assert.equal((await call(`/runs/${runId}`, { method: 'DELETE', bearer: other.accessToken })).status, 404)
  await pool.query('DELETE FROM users WHERE id = $1', [other.user.id]) // made no sessions
  await pool.query('DELETE FROM sessions WHERE id = $1', [id])
})
