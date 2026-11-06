// Stopping a run: a persona whose run is stopped ends at once, with
// "You stopped this run", whatever it was doing.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { chromium } from 'playwright'
import { runPersona } from '../src/persona.js'
import { createSemaphore } from '../src/browser.js'
import { serveFixtureDir } from '../src/checks/fixtureServer.js'
import { FIXTURES, FIXTURE_HOST, readProfilesSource } from './helpers.js'

let browser
let profilesSource
before(async () => {
  browser = await chromium.launch({ chromiumSandbox: true })
  profilesSource = await readProfilesSource()
})
after(async () => { await browser?.close() })

function stubStore() {
  const saved = { finalized: null }
  return {
    saved,
    async getSession() { return { start_time: new Date() } },
    async markRunning() {},
    async putVideo(id) { return `sessions/${id}/session.webm` },
    async putImage(key) { return key },
    async saveMoment() {},
    async finalize(id, data) { saved.finalized = data }
  }
}

async function run(signal) {
  const store = stubStore()
  const started = Date.now()
  await runPersona({ url: `${FIXTURE_HOST}/long-way.html` }, {
    sessionId: '00000000-0000-4000-8000-0000000000bb',
    persona: { name: 'David' },
    profiles: [{ id: 'keyboard-only', severity: 3 }]
  }, {
    browser, sem: createSemaphore(1, { log() {} }), blockedHosts: new Set(), store,
    progress: { phase() {}, moment() {}, done() {} }, profilesSource, signal,
    extraRoute: (ctx) => serveFixtureDir(ctx, path.join(FIXTURES, 'checks/keyboard'))
  })
  return { store, ms: Date.now() - started }
}

test('stopped before it starts: ends at once, as stopped by you', async () => {
  const stop = new AbortController()
  stop.abort()
  const { store, ms } = await run(stop.signal)
  assert.equal(store.saved.finalized.coverage.stoppedReason, 'You stopped this run.')
  assert.equal(store.saved.finalized.videoKey, null)
  assert.ok(ms < 15000, `took ${ms} ms`)
})

test('stopped while running: the browser closes and the run ends as stopped by you', async () => {
  const stop = new AbortController()
  setTimeout(() => stop.abort(), 1500)
  const { store, ms } = await run(stop.signal)
  assert.equal(store.saved.finalized.coverage.stoppedReason, 'You stopped this run.')
  assert.ok(ms < 20000, `took ${ms} ms`)
})
