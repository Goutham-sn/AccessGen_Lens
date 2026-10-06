// The timing correction rule (no browser needed).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planCut, deliveredClock } from '../src/videoSync.js'
import { pauseNote } from '../src/copy.js'

const base = { whiteStampMs: 5000, offStampMs: 5170, limitMs: 400 }

test('a mark seen close to its stamp sets the correction and a cut just after it', () => {
  const p = planCut({ ...base, onsetMs: 4940 })
  assert.equal(p.found, true)
  assert.equal(p.applied, true)
  assert.equal(p.correctionMs, -60)
  assert.equal(p.cutMs, 4940 + 160 + 80)
})

test('a correction over 400 ms is ignored, and the cut is late enough to drop the mark anyway', () => {
  const p = planCut({ ...base, onsetMs: 5600 })
  assert.equal(p.found, true)
  assert.equal(p.measuredMs, 600)
  assert.equal(p.applied, false)
  assert.equal(p.correctionMs, 0)
  assert.equal(p.cutMs, 5170 + 400)
})

test('a mark that is not found gives no correction and the same safe cut', () => {
  const p = planCut({ ...base, onsetMs: null })
  assert.equal(p.found, false)
  assert.equal(p.correctionMs, 0)
  assert.equal(p.cutMs, 5170 + 400)
})

test('the pause note names the persona and their filtered conditions only', () => {
  assert.equal(pauseNote('David', [{ id: 'keyboard-only' }, { id: 'deuteranopia' }]),
    "Showing the page without David's red-green colour blindness so it is readable.")
  assert.equal(pauseNote('James', [{ id: 'screen-reader' }, { id: 'keyboard-only' }]), null)
})

// The corrected case, with synthetic offsets. The page stamps the mark at
// wall time `videoStart + whiteStampMs`; a recording that lags by `lagMs`
// shows it at whiteStampMs + lagMs, and shows a moment at wall time T at
// T - videoStart + lagMs in the raw video. When the lag is within the limit
// the delivered clock must put every moment exactly where the video shows it.
const videoStart = 1_000_000
const LIMIT = 400
const stamps = { whiteStampMs: 5000, offStampMs: 5170, limitMs: LIMIT }

for (const lagMs of [-400, -250, -60, 0, 40, 120, 399, 400]) {
  test(`a recording that lags by ${lagMs} ms is corrected, and moments land where the video shows them`, () => {
    const plan = planCut({ ...stamps, onsetMs: stamps.whiteStampMs + lagMs })
    assert.equal(plan.found, true)
    assert.equal(plan.applied, true)
    assert.equal(plan.measuredMs, lagMs)
    assert.equal(plan.correctionMs, lagMs)
    assert.equal(plan.reason, null)
    const clock = deliveredClock({ videoStart, correctionMs: plan.correctionMs, cutMs: plan.cutMs })
    for (const wall of [videoStart + 6000, videoStart + 9500, videoStart + 15000]) {
      const shownInRaw = wall - videoStart + lagMs
      assert.equal(clock.toVideoMs(wall), shownInRaw - plan.cutMs, `moment at +${wall - videoStart} ms`)
    }
    // The first delivered frame is the raw video's frame at cutMs.
    assert.equal(clock.zeroWallMs, videoStart + plan.cutMs - lagMs)
    // The cut falls after the mark has gone, so it is not in the delivered video.
    assert.ok(plan.cutMs >= stamps.whiteStampMs + lagMs + 160)
  })
}

test('past the limit nothing is corrected, the measurement is kept, and the reason says so', () => {
  for (const lagMs of [-418, 401, 600]) {
    const plan = planCut({ ...stamps, onsetMs: stamps.whiteStampMs + lagMs })
    assert.equal(plan.found, true)
    assert.equal(plan.applied, false)
    assert.equal(plan.measuredMs, lagMs, 'measuredMs is recorded for every run where the mark is found')
    assert.equal(plan.correctionMs, 0)
    assert.equal(plan.reason,
      `The timing mark was seen ${lagMs} ms from where it was stamped, over the 400 ms limit, so no correction was used.`)
    assert.equal(plan.cutMs, stamps.offStampMs + LIMIT)
  }
})

test('a mark that is not found records why', () => {
  const plan = planCut({ ...stamps, onsetMs: null })
  assert.equal(plan.measuredMs, null)
  assert.equal(plan.reason, 'The timing mark was not found in the recording, so no correction was used.')
})
