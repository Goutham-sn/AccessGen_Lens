// The dev-only unverified mode. Checks that are built but not yet verified by
// hand run only with UNVERIFIED_CHECKS=1 and NODE_ENV not production, and
// their moments say so (the label text itself is checked in the backend and
// web tests, because the runner image has no copy of the backend's copy.js).
// Needs Chromium for the persona-flow tests, so run it
// in the runner container:
//   docker compose run --rm runner node --test test/unverified.test.js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import {
  RUNNER_CAPABILITIES, BUILT_UNVERIFIED, checkStatus, liveChecks, unverifiedEnabled, checksToRun
} from '../../backend/src/config/runnerCapabilities.js'
import { CHECKS, KEYBOARD_CHECKS, detectorsFor, capabilityGaps } from '../src/checks/index.js'
import { runPersona } from '../src/persona.js'
import { createSemaphore } from '../src/browser.js'
import { serveFixtureDir } from '../src/checks/fixtureServer.js'
import { FIXTURES, FIXTURE_HOST, readProfilesSource } from './helpers.js'

const ids = (list) => list.map((d) => d.id)
const keyboard = ['keyboard-only']

test('a check is live, unverified or not built, never two at once, and built checks have modules', () => {
  for (const id of BUILT_UNVERIFIED) {
    assert.equal(liveChecks().has(id), false, `${id} cannot be both unverified and live`)
    assert.equal(checkStatus(id), 'unverified')
    assert.ok(CHECKS[id], `${id} has a module`)
  }
  for (const id of liveChecks()) assert.equal(checkStatus(id), 'live')
  assert.equal(checkStatus('unnamed-controls'), null, 'not built yet')
  assert.deepEqual(capabilityGaps(), [])
})

test('the flag works only as 1, and never in production', () => {
  assert.equal(unverifiedEnabled({}), false)
  assert.equal(unverifiedEnabled({ UNVERIFIED_CHECKS: '0' }), false)
  assert.equal(unverifiedEnabled({ UNVERIFIED_CHECKS: 'true' }), false)
  assert.equal(unverifiedEnabled({ UNVERIFIED_CHECKS: '1' }), true, 'NODE_ENV unset is not production')
  assert.equal(unverifiedEnabled({ UNVERIFIED_CHECKS: '1', NODE_ENV: 'development' }), true)
  assert.equal(unverifiedEnabled({ UNVERIFIED_CHECKS: '1', NODE_ENV: 'production' }), false)
})

test('flag off: no keyboard check runs, so no moments can come from them', () => {
  assert.deepEqual(ids(detectorsFor(keyboard, { NODE_ENV: 'development' })), [])
  assert.deepEqual(checksToRun(keyboard, { NODE_ENV: 'development' }).filter((id) => BUILT_UNVERIFIED.includes(id)), [])
})

test('production ignores the flag', () => {
  assert.deepEqual(ids(detectorsFor(keyboard, { UNVERIFIED_CHECKS: '1', NODE_ENV: 'production' })), [])
})

test('flag on outside production: the five keyboard checks run, only for the profiles that list them', () => {
  const env = { UNVERIFIED_CHECKS: '1', NODE_ENV: 'development' }
  assert.deepEqual(ids(detectorsFor(keyboard, env)).sort(), ids(KEYBOARD_CHECKS).sort())
  assert.deepEqual(ids(detectorsFor(['deuteranopia'], env)), [], 'a conditions-only persona has none of them listed')
  for (const id of ids(KEYBOARD_CHECKS)) assert.equal(RUNNER_CAPABILITIES['keyboard-only'].checks[id], false, `${id} flag is still false`)
})

// ---- the persona flow on a fixture page, with the real detectors ----

let browser
let profilesSource
let work
before(async () => {
  browser = await chromium.launch({ chromiumSandbox: true })
  profilesSource = await readProfilesSource()
  work = await fs.mkdtemp(path.join(os.tmpdir(), 'unverified-'))
})
after(async () => {
  await browser?.close()
  await fs.rm(work, { recursive: true, force: true }).catch(() => {})
})

function stubStore() {
  const saved = { moments: [], finalized: null }
  return {
    saved,
    async getSession() { return { start_time: new Date(Date.now() - 2000) } },
    async markRunning() {},
    async putVideo(id, file) { const dest = path.join(work, `${id}.webm`); await fs.copyFile(file, dest); return `sessions/${id}/session.webm` },
    async putImage(key) { return key },
    async saveMoment(id, m, extra) { saved.moments.push({ m, extra }) },
    async finalize(id, data) { saved.finalized = data }
  }
}

// Runs the persona flow with the real detectors under the given environment.
async function runWith(env) {
  const before = { UNVERIFIED_CHECKS: process.env.UNVERIFIED_CHECKS, NODE_ENV: process.env.NODE_ENV }
  for (const [k, v] of Object.entries(env)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  const store = stubStore()
  try {
    const result = await runPersona({ url: `${FIXTURE_HOST}/focus-lost-run.html` }, {
      sessionId: '00000000-0000-4000-8000-0000000000aa',
      persona: { name: 'David' },
      profiles: [{ id: 'keyboard-only', severity: 3 }]
    }, {
      browser,
      sem: createSemaphore(1, { log() {} }),
      blockedHosts: new Set(),
      store,
      progress: { phase() {}, moment() {}, done() {} },
      profilesSource,
      extraRoute: (ctx) => serveFixtureDir(ctx, path.join(FIXTURES, 'checks/keyboard'))
    })
    return { store, result }
  } finally {
    for (const [k, v] of Object.entries(before)) { if (v === undefined) delete process.env[k]; else process.env[k] = v }
  }
}

test('flag off: a page with known problems gives no moments and no unverified record', async () => {
  const { store, result } = await runWith({ UNVERIFIED_CHECKS: undefined, NODE_ENV: 'development' })
  assert.equal(store.saved.moments.length, 0)
  assert.equal(result.coverage.unverifiedChecks, undefined)
})

test('production: the flag is ignored, no moments', async () => {
  const { store, result } = await runWith({ UNVERIFIED_CHECKS: '1', NODE_ENV: 'production' })
  assert.equal(store.saved.moments.length, 0)
  assert.equal(result.coverage.unverifiedChecks, undefined)
})

test('flag on outside production: moments come out, every one marked unverified, and the run says so', async () => {
  const { store, result } = await runWith({ UNVERIFIED_CHECKS: '1', NODE_ENV: 'development' })
  const saved = store.saved.moments
  assert.ok(saved.length >= 1, `moments saved: ${saved.length}`)
  for (const { m } of saved) assert.equal(m.unverified, true, `${m.detector} moment is marked unverified`)
  assert.deepEqual([...new Set(saved.map(({ m }) => m.detector))], ['focus-lost'])
  assert.deepEqual([...result.coverage.unverifiedChecks].sort(), [...BUILT_UNVERIFIED].sort())
  assert.equal(result.coverage.unverifiedMoments, saved.length)
})
