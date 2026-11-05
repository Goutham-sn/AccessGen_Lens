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
  assert.equal(checkStatus('reflow-320'), null, 'not built')
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

test('nothing is held back: every built check is live, for everyone, with no flag', () => {
  assert.deepEqual(BUILT_UNVERIFIED, [])
  for (const id of [...ids(KEYBOARD_CHECKS), 'page-audit']) assert.ok(liveChecks().has(id), `${id} is live`)
  for (const env of [{}, { NODE_ENV: 'production' }, { UNVERIFIED_CHECKS: '1', NODE_ENV: 'development' }]) {
    const run = ids(detectorsFor(keyboard, env))
    for (const id of [...ids(KEYBOARD_CHECKS), 'page-audit']) assert.ok(run.includes(id), `${id} runs for keyboard-only (${JSON.stringify(env)})`)
  }
  assert.ok(ids(detectorsFor(['deuteranopia'], {})).includes('page-audit'), 'the page audit runs for a conditions-only persona too')
  assert.ok(!ids(detectorsFor(['deuteranopia'], {})).includes('focus-lost'), 'keyboard checks stay with the people who use the keyboard')
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

test('a page with known problems gives its moments, none labelled unverified, in production too', async () => {
  for (const env of [{ UNVERIFIED_CHECKS: undefined, NODE_ENV: 'development' }, { UNVERIFIED_CHECKS: undefined, NODE_ENV: 'production' }]) {
    const { store, result } = await runWith(env)
    const saved = store.saved.moments
    const detectors = new Set(saved.map(({ m }) => m.detector))
    assert.ok(detectors.has('focus-lost'), `focus lost is found (${env.NODE_ENV}): ${[...detectors]}`)
    for (const { m } of saved) assert.equal(Boolean(m.unverified), false, `${m.detector} moment is not labelled unverified`)
    assert.equal(result.coverage.unverifiedChecks, undefined)
  }
})
