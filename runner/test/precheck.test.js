// The pre-check (src/precheck.js): one quick look at a page, counting the places
// Tab can reach.
// Needs Chromium, so run it in the runner container:
//   docker compose run --rm runner node --test test/precheck.test.js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { chromium } from 'playwright'
import { serveFixtureDir, FIXTURE_HOST } from '../src/checks/fixtureServer.js'
import { precheckPage, levelFor, BOT_WALL } from '../src/precheck.js'
import { tabWalk } from '../src/walk.js'
import { config } from '../src/config.js'
import { FIXTURES } from './helpers.js'
import { RUNNER_PROFILES, TASK_PROFILES, PRECHECK_SIGNALS } from '../../backend/src/config/runnerCapabilities.js'

let browser
before(async () => { browser = await chromium.launch({ chromiumSandbox: true }) })
after(async () => { await browser?.close() })

async function open(dir, file) {
  const context = await browser.newContext({ viewport: config.viewport })
  await serveFixtureDir(context, path.join(FIXTURES, dir))
  const page = await context.newPage()
  return { context, page, url: `${FIXTURE_HOST}/${file}` }
}

async function check(file, dir = 'precheck', ms = config.precheck.deadlineMs) {
  const { context, page, url } = await open(dir, file)
  try {
    const started = Date.now()
    const result = await precheckPage(page, url, { deadline: Date.now() + ms })
    return { result, tookMs: Date.now() - started }
  } finally {
    await context.close()
  }
}

test('a page with nothing to reach: none', async () => {
  const { result } = await check('zero.html')
  assert.equal(result.ok, true)
  assert.deepEqual(result.reachableStops, { count: 0, level: 'none' })
})

test('a page with three places to land: few', async () => {
  const { result } = await check('few.html')
  assert.deepEqual(result.reachableStops, { count: 3, level: 'few' })
})

test('a page with many places to land: plenty', async () => {
  const { result } = await check('many.html')
  assert.deepEqual(result.reachableStops, { count: 30, level: 'plenty' })
})

test('a page that fills in after it loads is counted as a person would see it', async () => {
  const { result } = await check('late.html')
  assert.equal(result.ok, true)
  assert.equal(result.reachableStops.count, 4, 'read before the links appeared, this would be 0')
  assert.equal(result.reachableStops.level, 'few')
  assert.ok(result.readyMs >= 800, `ready at ${result.readyMs} ms`)
})

test('the count agrees with the real Tab walk on tricky markup', async () => {
  const { result } = await check('tricky.html')
  assert.equal(result.ok, true)

  const { context, page, url } = await open('precheck', 'tricky.html')
  try {
    await page.goto(url)
    const walk = await tabWalk(page, { deadline: Date.now() + 20000 })
    const places = walk.stops.filter((s) => s.kind === 'element' && !s.revisit).length
    assert.equal(places, 12, 'the fixture is written to give twelve stops; the walk found ' + places)
    assert.equal(result.reachableStops.count, places, 'the pre-check count differs from the walk')
  } finally {
    await context.close()
  }
})

test('a link wrapped around a block, like a vote arrow, is counted, as the real walk counts it', async () => {
  const { result } = await check('inline-box.html')
  const { context, page, url } = await open('precheck', 'inline-box.html')
  try {
    await page.goto(url)
    const walk = await tabWalk(page, { deadline: Date.now() + 20000 })
    const places = walk.stops.filter((s) => s.kind === 'element' && !s.revisit).length
    assert.equal(places, 3)
    assert.equal(result.reachableStops.count, places)
  } finally {
    await context.close()
  }
})

test('a page whose content is in a frame is unsure, never none', async () => {
  const { result } = await check('framed.html')
  assert.equal(result.reachableStops.count, 0)
  assert.equal(result.reachableStops.level, 'unsure')
})

test('levels: more than the threshold is plenty, a frame only matters when the count is low', () => {
  assert.equal(levelFor({ count: 6, frames: 1, truncated: false }), 'plenty')
  assert.equal(levelFor({ count: 5, frames: 0, truncated: false }), 'few')
  assert.equal(levelFor({ count: 0, frames: 0, truncated: false }), 'none')
  assert.equal(levelFor({ count: 2, frames: 1, truncated: false }), 'unsure')
  assert.equal(levelFor({ count: 0, frames: 0, truncated: true }), 'plenty', 'too big to count: not a small page')
})

test('a bot wall is said as such, not as an empty page', async () => {
  const { result } = await check('challenge.html', 'bot-wall')
  assert.equal(result.ok, false)
  assert.equal(result.reason, BOT_WALL)
  assert.equal(result.reachableStops, undefined)
})

test('a page that never shows anything stops at the deadline, and says how long it waited', async () => {
  const { result, tookMs } = await check('never-content.html', 'load', 3000)
  assert.equal(result.ok, false)
  assert.match(result.reason, /still empty after 3 seconds/)
  assert.ok(tookMs < 5000, `took ${tookMs} ms`)
})

test('the profiles that get a pre-check note are all profiles a run can simulate, and tunnel vision only in a run with something to find', () => {
  for (const [signal, profiles] of Object.entries(PRECHECK_SIGNALS)) {
    assert.ok(profiles.length > 0, signal)
    for (const p of profiles) assert.ok(RUNNER_PROFILES.has(p) || TASK_PROFILES.has(p), `${signal}: ${p} is not a profile the runner can run`)
  }
  assert.ok(TASK_PROFILES.has('tunnel-vision') && !RUNNER_PROFILES.has('tunnel-vision'), 'tunnel vision is simulated in task runs only')
})

test('the pre-check never says whether anything is done well: no verdict words in what it returns', async () => {
  const { result } = await check('few.html')
  assert.doesNotMatch(JSON.stringify(result), /WCAG|violation|fail|invalid|error|pass/i)
})
