// Every check marked live in backend/src/config/runnerCapabilities.js must
// have a registered module, a fixture with expected.json, and must produce
// exactly that result on its fixture. Needs Chromium, so run it in the
// runner container:
//   docker compose run --rm runner node --test test/capabilities.test.js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { liveChecks } from '../../backend/src/config/runnerCapabilities.js'
import { CHECKS, capabilityGaps } from '../src/checks/index.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.join(here, '../fixtures/checks')

let browser
let profilesSource
before(async () => {
  browser = await chromium.launch({ chromiumSandbox: true })
  profilesSource = await fs.readFile(path.join(here, '../dist/profiles.js'), 'utf8')
})
after(async () => { await browser?.close() })

test('the runner and the capabilities file agree', () => {
  assert.deepEqual(capabilityGaps(), [])
})

for (const id of liveChecks()) {
  test(`live check "${id}" is registered and gives its expected result on its fixture`, async () => {
    const check = CHECKS[id]
    assert.ok(check, `no module registered for "${id}"`)
    const fixtureDir = path.join(FIXTURES, id)
    const raw = await fs.readFile(path.join(fixtureDir, 'expected.json'), 'utf8').catch(() => null)
    assert.ok(raw, `no fixtures/checks/${id}/expected.json`)
    const expected = JSON.parse(raw)
    const result = await check.runFixture(browser, { fixtureDir, expected, profilesSource })
    assert.deepEqual(result, expected)
  })
}
