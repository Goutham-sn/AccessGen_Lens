// Everything Tab skips is a moment of its own, on camera, for whoever is
// simulated: a keyboard user and a person with low vision both get them.
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

const SKIPPED = ['Save draft', 'See pricing', 'Email', 'Open the order', 'Add to basket', 'Delete', 'Read more', 'Choose a plan', 'Dark mode', 'Next slide']

async function run(profiles) {
  const moments = []
  const store = {
    async getSession() { return { start_time: new Date() } },
    async markRunning() {},
    async putVideo(id) { return `sessions/${id}/session.webm` },
    async putImage(key) { return key },
    async saveMoment(_id, m) { moments.push(m) },
    async finalize() {}
  }
  await runPersona({ url: `${FIXTURE_HOST}/skipped.html` }, {
    sessionId: '00000000-0000-4000-8000-0000000000cc',
    persona: { name: 'David' },
    profiles
  }, {
    browser, sem: createSemaphore(2, { log() {} }), blockedHosts: new Set(), store,
    progress: { phase() {}, moment() {}, done() {}, log() {} }, profilesSource,
    extraRoute: (ctx) => serveFixtureDir(ctx, path.join(FIXTURES, 'checks/tab-skipped'))
  })
  return moments
}

for (const profiles of [[{ id: 'keyboard-only', severity: 3 }], [{ id: 'low-vision', severity: 2 }]]) {
  test(`every thing Tab skips is its own moment (${profiles[0].id})`, { timeout: 240000 }, async () => {
    const moments = await run(profiles)
    const skipped = moments.filter((m) => /^Tab skips /.test(m.headline || ''))
    for (const name of SKIPPED) {
      assert.ok(skipped.some((m) => m.headline.includes(`"${name}"`)), `"${name}" is a moment; got: ${skipped.map((m) => m.headline).join(' | ')}`)
    }
    assert.equal(skipped.length, SKIPPED.length, 'nothing the keyboard can reach is reported')
    assert.ok(moments.some((m) => /^Tab jumps out of order: "Search"/.test(m.headline || '')), 'the forced Tab order is a moment')
  })
}
