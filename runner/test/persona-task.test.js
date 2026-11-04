// Task Mode through runPersona, with a stub store (two passes, moment before
// failure, confirmation, the time limit, a message box):
//   docker compose run --rm runner node --test test/persona-task.test.js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import { createSemaphore } from '../src/browser.js'
import { config } from '../src/config.js'
import { runPersona } from '../src/persona.js'
import { serveFixtureDir, FIXTURE_HOST } from '../src/checks/fixtureServer.js'
import { FIXTURES, readProfilesSource, extractFrames, pixelsOf } from './helpers.js'

let browser
let profilesSource
let work
before(async () => {
  browser = await chromium.launch({ chromiumSandbox: true })
  profilesSource = await readProfilesSource()
  work = await fs.mkdtemp(path.join(os.tmpdir(), 'persona-task-'))
})
after(async () => {
  await browser?.close()
  await fs.rm(work, { recursive: true, force: true })
})

let videoCount = 0

// Records what was saved and in what order.
function stubStore() {
  const saved = { moments: [], failures: [], events: [], video: null, finalized: null }
  return {
    saved,
    async getSession() { return { start_time: new Date(Date.now() - 2000) } },
    async markRunning() {},
    async putVideo(id, file) {
      saved.video = path.join(work, `video-${videoCount++}.webm`)
      await fs.copyFile(file, saved.video)
      return 'video-key'
    },
    async putImage(key) { return key },
    async saveMoment(id, m, extra) {
      saved.moments.push({ m, extra })
      saved.events.push('moment')
      return `moment-${m.number}`
    },
    async saveTaskFailure(id, failure, extra) {
      saved.failures.push({ failure, extra })
      saved.events.push('failure')
      return 'failure-1'
    },
    async finalize(id, data) { saved.finalized = data }
  }
}

const quietProgress = { phase() {}, moment() {}, done() {} }

async function run(file, intents, profiles = [{ id: 'keyboard-only', severity: 3 }], job = {}) {
  const store = stubStore()
  const result = await runPersona({
    url: `${FIXTURE_HOST}/${file}`,
    mode: 'task',
    task: { goal: 'A goal', intents },
    ...job
  }, {
    sessionId: '00000000-0000-4000-8000-0000000000aa',
    persona: { name: 'Meera' },
    profiles
  }, {
    browser,
    sem: createSemaphore(2, { log() {} }),
    blockedHosts: new Set(),
    store,
    progress: quietProgress,
    profilesSource,
    extraRoute: (ctx) => serveFixtureDir(ctx, path.join(FIXTURES, 'task'))
  })
  return { store, result }
}

test('a task that is reached makes no moment and no failure, and the video is kept', async () => {
  const { store, result } = await run('home.html', ['find pricing page', 'add item to cart'])
  assert.equal(result.coverage.stoppedReason, undefined)
  assert.deepEqual(result.coverage.task, { intents: 2, reached: 2, ended: 'done' })
  assert.equal(store.saved.moments.length, 0)
  assert.equal(store.saved.failures.length, 0)
  assert.ok(store.saved.video)
  assert.equal(result.debug.mismatches.length, 0, JSON.stringify(result.debug.mismatches))
  assert.equal(result.debug.dropped.length, 0)
})

test('no detector runs in a task run', async () => {
  const { result } = await run('home.html', ['find pricing page'])
  assert.equal(result.coverage.unverifiedChecks, undefined)
  assert.deepEqual(result.debug.detectorProblems, [])
})

test('an intent that is not reached becomes a moment, then a failure linked to it', async () => {
  const { store, result } = await run('home.html', ['find pricing page', 'find careers page', 'reach checkout form'])
  assert.deepEqual(store.saved.events, ['moment', 'failure'], 'the moment is saved first')
  assert.equal(store.saved.moments.length, 1)

  const { m } = store.saved.moments[0]
  assert.equal(m.detector, 'task-find')
  assert.equal(m.headline, 'Meera would not find “find careers page”.')
  assert.match(m.fact, /It was step 2 of 3\. The step before it was reached\./)

  const { failure, extra } = store.saved.failures[0]
  assert.equal(extra.momentId, 'moment-1', 'the row links to its moment')
  assert.equal(failure.intent, 'find careers page')
  assert.equal(failure.intentIndex, 1)
  assert.equal(failure.reason, 'wrapped')
  assert.equal(failure.profile, 'keyboard-only')
  assert.equal(failure.missed, null)

  assert.deepEqual(result.coverage.task, { intents: 3, reached: 1, ended: 'failed' })
  assert.equal(result.debug.dropped.length, 0)
  assert.equal(result.debug.mismatches.length, 0, JSON.stringify(result.debug.mismatches))
})

test('the structured layer stays out of the words of the moment', async () => {
  const { store } = await run('home.html', ['find careers page'])
  const { m } = store.saved.moments[0]
  const text = `${m.headline} ${m.fact} ${m.forTeam}`
  assert.doesNotMatch(text, /wrapped|budget-|task_failures|reason/i)
  assert.deepEqual(m.evidence, { intentNumber: 1, intentCount: 1, stopsAttempted: 4 })
})

test('tunnel vision: what was out of sight is shown, and recorded as missed', async () => {
  const { store, result } = await run('peripheral.html', ['find pricing page'], [{ id: 'tunnel-vision', severity: 2 }])
  assert.equal(result.coverage.filtersApplied, 1, 'the condition is on when it is the only profile')
  const { m } = store.saved.moments[0]
  assert.equal(m.headline, 'Meera would not notice “Pricing” when Tab reached it.')
  assert.equal(m.element.name, 'Pricing', 'the ring is on the link that could not be made out')
  const { failure } = store.saved.failures[0]
  assert.equal(failure.profile, 'tunnel-vision')
  assert.equal(failure.reason, 'wrapped')
  assert.equal(failure.missed.stop.name, 'Pricing')
  assert.equal(failure.missed.score, 1)
})

test('a page that is not there is recorded with nothing missed', async () => {
  const { store } = await run('peripheral.html', ['find careers page'], [{ id: 'tunnel-vision', severity: 2 }])
  assert.equal(store.saved.failures[0].failure.missed, null)
})

test('the time limit keeps the row but makes no moment', async () => {
  const cap = config.personaCapMs
  const wait = config.task.activationWaitMs
  // Enter on a button that loads no new page waits out activationWaitMs, so
  // here it waits until the 6 s allowed for the whole run are gone, and the
  // intent after "add item to cart" meets the time limit.
  config.personaCapMs = 6000
  config.task.activationWaitMs = 8000
  try {
    const { store, result } = await run('home.html', ['find pricing page', 'add item to cart', 'go to checkout', 'reach checkout form'])
    assert.equal(store.saved.moments.length, 0)
    assert.equal(store.saved.failures.length, 1)
    assert.equal(store.saved.failures[0].failure.reason, 'budget-time')
    assert.equal(store.saved.failures[0].extra.momentId, null)
    assert.match(result.coverage.stoppedReason, /time limit/)
    assert.ok(result.coverage.notes.some((n) => /We ran out of time while looking for/.test(n)))
    assert.equal(result.coverage.walkIncomplete, true)
  } finally {
    config.personaCapMs = cap
    config.task.activationWaitMs = wait
  }
})

test('a found place that would leave the site is not pressed, and the run says so', async () => {
  const { store, result } = await run('leaves.html', ['find pricing page', 'reach checkout form'])
  assert.equal(store.saved.failures.length, 0, 'the runner’s limit is not the persona’s failure')
  assert.equal(store.saved.moments.length, 0)
  assert.equal(result.coverage.task.reached, 1)
  assert.equal(result.coverage.task.ended, 'stopped')
  assert.match(result.coverage.stoppedReason, /did not press it, because it leads to another site/)
  assert.ok(store.saved.video, 'the video of what was reached is kept')
})

test('a message box after Enter ends the run, left untouched', async () => {
  const { store, result } = await run('alert.html', ['add item to cart', 'go to checkout'])
  assert.match(result.coverage.stoppedReason, /browser message box after we pressed Enter/)
  assert.equal(store.saved.failures.length, 0)
  assert.ok(store.saved.finalized, 'the run still ends')
})

test('a list that cannot be read stops the run with a plain reason', async () => {
  const { store, result } = await run('home.html', [], undefined, { task: { goal: 'x', intents: [] } })
  assert.match(result.coverage.stoppedReason, /the list could not be read/)
  assert.equal(store.saved.moments.length, 0)
})

test('without mode: task it is a regular run, whatever else the job carries', async () => {
  const { result } = await run('home.html', ['find pricing page'], undefined, { mode: undefined })
  assert.equal(result.coverage.task, undefined)
})

// Brightness of one pixel of an image: [r, g, b].
async function pixelOf(buffer, point, mime) {
  const page = await browser.newPage()
  try { return (await pixelsOf(page, buffer, [point], mime)).pixels[0] } finally { await page.close() }
}
const dark = ([r, g, b]) => r < 70 && g < 70 && b < 70
const blue = ([r, g, b]) => b > 150 && r < 90
// A pixel inside the link in the far corner of peripheral.html, below the key chip.
const CORNER_LINK = [1190, 700]

async function earlyFrames(video, dir) {
  const frames = (await extractFrames(video, path.join(work, dir))).filter((f) => f.ms >= 100 && f.ms <= 800)
  assert.ok(frames.length >= 3, `frames between 0.1 and 0.8 s: ${frames.length}`)
  return frames
}

test('the recorded video shows the tunnel: the far corner is dark for tunnel vision and plain for others', async (t) => {
  // Each stop is held for a second, so the link in the corner is dark from the
  // start until Tab is pressed from it (which moves where the person was just
  // at onto it, as the walk judges), whatever the timing of the recording.
  const pace = config.walk.recordedPaceMs
  config.walk.recordedPaceMs = 1000
  t.after(() => { config.walk.recordedPaceMs = pace })
  const narrow = await run('peripheral.html', ['find pricing page'], [{ id: 'tunnel-vision', severity: 2 }])
  for (const f of await earlyFrames(narrow.store.saved.video, 'frames-narrow')) {
    const px = await pixelOf(await fs.readFile(f.file), CORNER_LINK, 'image/png')
    assert.ok(dark(px), `tunnel vision, corner link at ${f.ms} ms: ${px}`)
  }
  const plain = await run('peripheral.html', ['find pricing page'], [{ id: 'keyboard-only', severity: 2 }])
  for (const f of await earlyFrames(plain.store.saved.video, 'frames-plain')) {
    const px = await pixelOf(await fs.readFile(f.file), CORNER_LINK, 'image/png')
    assert.ok(blue(px), `keyboard only, corner link at ${f.ms} ms: ${px}`)
  }
})

test('the moment shows the persona view dark and the clean picture plain, with the pause note', async () => {
  const { store } = await run('peripheral.html', ['find pricing page'], [{ id: 'tunnel-vision', severity: 2 }])
  const { m, extra } = store.saved.moments[0]
  assert.equal(m.pauseNote, "Showing the page without Meera's tunnel vision so it is readable.")
  assert.ok(extra.shotKeys.persona, 'a persona view is stored')
  assert.ok(dark(await pixelOf(m.shots.persona, CORNER_LINK, 'image/jpeg')), 'the link could not be made out')
  assert.ok(blue(await pixelOf(m.shots.clean, CORNER_LINK, 'image/jpeg')), 'the clean picture shows it')
})

test('the persona view and the ring are on the pages after Enter loads a new one', async () => {
  const { store } = await run('home.html', ['find pricing page', 'find careers page'],
    [{ id: 'keyboard-only', severity: 2 }, { id: 'deuteranopia', severity: 2 }])
  const { m, extra } = store.saved.moments[0]
  assert.equal(m.step, null)
  assert.ok(m.overlay && m.overlay.ring, 'the ring is drawn on the second page')
  assert.ok(extra.shotKeys.persona, 'the colour filter is on the second page')
  assert.equal(m.pauseNote, "Showing the page without Meera's red-green colour blindness so it is readable.")
})

test('tunnel vision stays on after Enter loads a new page', async () => {
  const { store } = await run('home.html', ['find pricing page', 'find careers page'], [{ id: 'tunnel-vision', severity: 2 }])
  const { m, extra } = store.saved.moments[0]
  assert.ok(extra.shotKeys.persona, 'the dark is on the second page')
  assert.ok(m.overlay && m.overlay.ring)
})
