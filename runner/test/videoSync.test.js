// The timing correction rule (no browser needed).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { planCut } from '../src/videoSync.js'
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
