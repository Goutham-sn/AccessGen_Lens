// "What we looked at" and the no-moments lines (no database needed):
//   docker compose exec backend node --test test/lookedAt.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lookedAt, noMomentsText } from '../src/utils/lookedAt.js'
import { CHECK_WORDS } from '../src/config/copy.js'
import { allChecks, liveChecksFor } from '../src/config/runnerCapabilities.js'

const runner = (extra = {}, coverage = {}) => ({
  source: 'runner',
  processing_complete: true,
  persona_snapshot: { name: 'David' },
  active_profiles: [{ id: 'keyboard-only' }, { id: 'deuteranopia' }],
  coverage: { presses: 14, notes: ['Focus entered a frame from another site at stop 3. We could not look inside it.'], ...coverage },
  ...extra
})

test('every check has words', () => {
  for (const id of allChecks()) assert.ok(CHECK_WORDS[id], `no words for "${id}"`)
})

test('lists only the live checks for the session conditions, with the coverage lines', () => {
  const looked = lookedAt(runner(), 3)
  assert.deepEqual(looked.items, liveChecksFor(['keyboard-only', 'deuteranopia']).map((id) => CHECK_WORDS[id]))
  assert.equal(looked.noItems, null)
  assert.deepEqual(looked.gaps, ['Focus entered a frame from another site at stop 3. We could not look inside it.'])
  assert.equal(looked.zeroMoments, null, 'there are moments')
})

test('no moments after a Tab walk: says what was done and how little we look at', () => {
  const looked = lookedAt(runner(), 0)
  assert.equal(looked.zeroMoments,
    `We pressed Tab 14 times and noticed nothing that matches what we look for here. We only look at these ${looked.items.length} things.`)
})

test('no Tab walk: says the page was recorded and nothing else measured', () => {
  const looked = lookedAt(runner({ active_profiles: [{ id: 'low-vision' }] }, { presses: undefined }), 0)
  assert.equal(looked.zeroMoments, 'We recorded the page as David would see it. We did not measure anything else in this run.')
})

test('no live check for the conditions: says so instead of a list', () => {
  const looked = lookedAt(runner({ active_profiles: [{ id: 'screen-reader' }] }), 2)
  assert.deepEqual(looked.items, [])
  assert.equal(looked.noItems, 'We do not measure anything for these conditions yet. The video shows the page as David would see it.')
})

test('a stopped run or an incomplete walk is never summarised as a normal result', () => {
  const stopped = runner({}, { stoppedReason: 'The page was still empty after 12 seconds, so we could not look at it.' })
  assert.equal(lookedAt(stopped, 0).zeroMoments, null)
  assert.equal(noMomentsText(stopped, 0), 'The page was still empty after 12 seconds, so we could not look at it.')
  assert.equal(lookedAt(runner({}, { walkIncomplete: true }), 0).zeroMoments, null)
  assert.equal(lookedAt(runner({ processing_complete: false }), 0).zeroMoments, null)
})

test('extension sessions with no moments point to I Felt This', () => {
  const ext = { source: 'extension', coverage: null }
  assert.equal(lookedAt(ext, 0), null)
  assert.equal(noMomentsText(ext, 0), 'You did not mark any moments in this session. Press I Felt This when something feels wrong.')
  assert.equal(noMomentsText(ext, 2), null)
})

test('a run that included unverified checks says so, separately from what was looked at', () => {
  const withUnverified = runner({}, { unverifiedChecks: ['focus-lost', 'trap'], unverifiedMoments: 2 })
  const looked = lookedAt(withUnverified, 2)
  assert.deepEqual(looked.unverified, {
    label: 'Unverified, for testing',
    items: [CHECK_WORDS['focus-lost'], CHECK_WORDS.trap],
    moments: 2
  })
  assert.ok(!looked.items.includes(CHECK_WORDS.trap), 'unverified checks are never listed with the live ones')
  // The no-moments line counts what was run, unverified included.
  const none = lookedAt(withUnverified, 0)
  assert.equal(none.zeroMoments,
    `We pressed Tab 14 times and noticed nothing that matches what we look for here. We only look at these ${looked.items.length + 2} things.`)
  // Without the dev mode there is no unverified block at all.
  assert.equal(lookedAt(runner(), 2).unverified, null)
})
