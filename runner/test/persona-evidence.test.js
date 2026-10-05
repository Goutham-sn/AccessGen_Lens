// The recorded pass end to end, with a stub store and a test detector:
//   docker compose run --rm runner node --test test/persona-evidence.test.js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import { createSemaphore } from '../src/browser.js'
import { runPersona } from '../src/persona.js'
import { serveFixtureDir, FIXTURE_HOST } from '../src/checks/fixtureServer.js'
import { FIXTURES, readProfilesSource, extractFrames, pixelsOf, isMagenta } from './helpers.js'
import { stick } from '../src/measuringStick.js'

let browser
let profilesSource
let work
before(async () => {
  browser = await chromium.launch({ chromiumSandbox: true })
  profilesSource = await readProfilesSource()
  work = await fs.mkdtemp(path.join(os.tmpdir(), 'persona-evidence-'))
})
after(async () => {
  await browser?.close()
  await fs.rm(work, { recursive: true, force: true })
})

function stubStore(startTime) {
  const saved = { moments: [], images: [], video: null, finalized: null }
  return {
    saved,
    async getSession() { return { start_time: startTime } },
    async markRunning() {},
    async putVideo(id, file) { saved.video = path.join(work, 'video.webm'); await fs.copyFile(file, saved.video); return `sessions/${id}/session.webm` },
    async putImage(key, buf) { saved.images.push({ key, bytes: buf.length }); return key },
    async saveMoment(id, m, extra) { saved.moments.push({ m, extra }) },
    async finalize(id, data) { saved.finalized = data }
  }
}

const quietProgress = { phase() {}, moment() {}, done() {} }

// Flags the second Tab stop, plus two findings that must not survive.
const testDetector = {
  id: 'test-detector',
  onStop({ stop, step }) {
    if (step === 2) {
      return [{
        detector: 'test-detector', profile: 'keyboard-only', selector: stop.selector,
        headline: 'David would lose his place here.', fact: 'A measured fact.', forTeam: 'What would change it.',
        evidence: { measured: true }
      }]
    }
    return []
  },
  measure() {
    return [
      { detector: 'test-detector', profile: 'keyboard-only', selector: '#gone', patternKey: 'gone',
        headline: 'x', fact: 'x', forTeam: 'x' },
      { detector: 'test-detector', profile: 'keyboard-only', selector: 'button', step: 99, patternKey: 'unreached',
        headline: 'x', fact: 'x', forTeam: 'x' }
    ]
  },
  confirm({ finding }) { return finding.selector !== '#gone' }
}

test('a confirmed finding becomes a moment whose highlight appears at its video time', async () => {
  const startTime = new Date(Date.now() - 2000)
  const store = stubStore(startTime)
  const result = await runPersona({ url: `${FIXTURE_HOST}/three.html` }, {
    sessionId: '00000000-0000-4000-8000-000000000001',
    persona: { name: 'Test' },
    profiles: [{ id: 'keyboard-only', severity: 3 }, { id: 'deuteranopia', severity: 3 }]
  }, {
    browser,
    sem: createSemaphore(2, { log() {} }),
    blockedHosts: new Set(),
    store,
    progress: quietProgress,
    profilesSource,
    detectors: [testDetector],
    extraRoute: (ctx) => serveFixtureDir(ctx, path.join(FIXTURES, 'walk'))
  })

  assert.equal(result.coverage.stoppedReason, undefined)
  assert.equal(store.saved.moments.length, 1, 'one moment saved')
  const { m, extra } = store.saved.moments[0]
  assert.equal(m.step, 2)
  assert.equal(m.held, true)
  assert.ok(m.shots && extra.shotKeys.shot && extra.shotKeys.clean && extra.shotKeys.closeup, 'three pictures stored')
  assert.ok(extra.shotKeys.persona, 'the persona view (deuteranopia on) is stored too')
  assert.equal(m.pauseNote, "Showing the page without Test's red-green colour blindness so it is readable.")

  // The delivered video starts after the timing mark, and says so.
  const sync = store.saved.finalized.timings.sync
  assert.equal(sync.found, true, 'timing mark found')
  assert.equal(sync.applied, true, `correction applied (${sync.measuredMs} ms)`)
  assert.ok(Math.abs(sync.measuredMs) <= 400)
  assert.equal(sync.noMarkInVideo, true, 'no trace of the mark in the delivered video')

  // Session time and video time agree with recording_offset_ms.
  const offset = store.saved.finalized.recordingOffsetMs
  assert.equal(extra.timestampMs - offset, m.videoMs, 'timestamp_ms - recording_offset_ms = video_ms')

  // Dropped, with reasons: the vanished element and the unreached stop.
  const reasons = result.debug.dropped.map((d) => d.reason).sort()
  assert.deepEqual(reasons, ['did not happen again', 'the recorded walk did not reach this stop'])

  // In the saved (trimmed) video, the ring shows up within the tolerance.
  const frames = await extractFrames(store.saved.video, path.join(work, 'frames'))
  const ring = m.overlay.ring
  const point = [Math.round(ring.x + 1), Math.round(ring.y + ring.height / 2)]
  const page = await browser.newPage()
  let firstMagentaMs = null
  for (const f of frames.filter((x) => x.ms >= m.videoMs - 500 && x.ms <= m.videoMs + 1500)) {
    const px = await pixelsOf(page, await fs.readFile(f.file), [point])
    if (isMagenta(px.pixels[0])) { firstMagentaMs = f.ms; break }
  }
  await page.close()
  assert.ok(firstMagentaMs !== null, 'the ring is visible in the video')
  const tolerance = stick('calibration', 'toleranceMs')
  assert.ok(Math.abs(firstMagentaMs - m.videoMs) <= tolerance,
    `ring first seen at ${firstMagentaMs} ms, moment says ${m.videoMs} ms (tolerance ${tolerance} ms)`)
})
