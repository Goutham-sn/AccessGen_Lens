// The five keyboard detectors on their fixtures, whether or not their
// capability flag is on yet (capabilities.test.js only runs live checks).
// Every page in fixtures/checks/keyboard is listed in each detector's
// expected.json: its own pages with known counts, and every other page,
// the clean one and the tricky ones, with the count that detector must give
// there (zero unless it is one of its own).
// Needs Chromium, so run it in the runner container:
//   docker compose run --rm runner node --test test/keyboard.test.js
// KEYBOARD_DETAILS=1 also prints each finding's wording.
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { KEYBOARD_CHECKS } from '../src/checks/index.js'
import { findCycle } from '../src/walk.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.join(here, '../fixtures/checks')
const details = process.env.KEYBOARD_DETAILS === '1'

let browser
before(async () => { browser = await chromium.launch({ chromiumSandbox: true }) })
after(async () => { await browser?.close() })

test('every keyboard fixture page is listed for every keyboard detector', async () => {
  const pages = (await fs.readdir(path.join(FIXTURES, 'keyboard')))
    .filter((f) => f.endsWith('.html') && f !== 'frame-buttons.html')
    .map((f) => `../keyboard/${f}`)
    .sort()
  for (const check of KEYBOARD_CHECKS) {
    const expected = JSON.parse(await fs.readFile(path.join(FIXTURES, check.id, 'expected.json'), 'utf8'))
    assert.deepEqual(Object.keys(expected).sort(), pages, `${check.id}/expected.json`)
  }
})

for (const check of KEYBOARD_CHECKS) {
  test(`${check.id} gives its expected result on every keyboard fixture`, async () => {
    const fixtureDir = path.join(FIXTURES, check.id)
    const expected = JSON.parse(await fs.readFile(path.join(fixtureDir, 'expected.json'), 'utf8'))
    const result = await check.runFixture(browser, { fixtureDir, expected, details })
    if (details) {
      for (const [page, r] of Object.entries(result)) {
        for (const d of r.details || []) console.log(`\n[${check.id}] ${page}\n  ${d.headline}\n  ${d.fact}\n  For your team: ${d.forTeam}`)
        delete r.details
      }
    }
    assert.deepEqual(result, expected)
  })
}

const stop = (selector, kind = 'element') => ({ kind, selector })

test('a cycle needs the same places, in the same order, three times', () => {
  const round = [stop('#a'), stop('#b'), stop('#c')]
  assert.deepEqual(findCycle([stop('#start'), ...round, ...round, ...round], 3), { fromStep: 2, k: 3, rounds: 3, presses: 9 })
  assert.equal(findCycle([stop('#start'), ...round, ...round], 3), null, 'two rounds are not enough')
  assert.equal(findCycle([stop('#a'), stop('#b'), stop('#a'), stop('#c'), stop('#a'), stop('#b')], 3), null)
})

test('one place repeated, or a frame, is never a cycle', () => {
  assert.equal(findCycle([stop('#x'), stop('#x'), stop('#x'), stop('#x')], 3), null)
  const f = stop('iframe', 'frame')
  assert.equal(findCycle([f, stop('#a'), f, stop('#a'), f, stop('#a')], 3), null)
})
