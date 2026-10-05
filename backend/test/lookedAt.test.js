// "What we looked at" and the no-moments line (no database needed):
//   docker compose exec backend node --test test/lookedAt.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { lookedAt } from '../src/utils/lookedAt.js'
import { zeroMomentsLine, CHECK_WORDS } from '../src/config/copy.js'
import { liveChecks, allChecks } from '../src/config/runnerCapabilities.js'

const runner = (extra = {}) => ({
  source: 'runner',
  processing_complete: true,
  active_profiles: [{ id: 'keyboard-only' }, { id: 'deuteranopia' }],
  coverage: { presses: 14, notes: ['Focus entered a frame from another site at stop 3. We could not look inside it.'] },
  ...extra
})

test('every check has words', () => {
  for (const id of allChecks()) assert.ok(CHECK_WORDS[id], `no words for "${id}"`)
})

test('lists only the live checks for the session conditions, with the coverage lines', () => {
  const looked = lookedAt(runner(), 3)
  const live = [...liveChecks()].filter((id) => ['tab-walk', 'filter-video'].includes(id))
  assert.deepEqual(looked.items, live.map((id) => CHECK_WORDS[id]))
  assert.deepEqual(looked.gaps, ['Focus entered a frame from another site at stop 3. We could not look inside it.'])
  assert.equal(looked.zeroMoments, null, 'there are moments')
})

test('no moments: says what was done and how little we look at', () => {
  const looked = lookedAt(runner(), 0)
  assert.equal(looked.zeroMoments,
    `We pressed Tab 14 times and noticed nothing that matches what we look for here. We only look at these ${looked.items.length} things.`)
  assert.equal(zeroMomentsLine({ presses: null, things: 1 }),
    'We looked at the page and noticed nothing that matches what we look for here. We only look at this one thing.')
})

test('not for sessions the runner did not make, and not before a run is finished', () => {
  assert.equal(lookedAt({ ...runner(), source: 'extension' }, 0), null)
  assert.equal(lookedAt(runner({ processing_complete: false }), 0).zeroMoments, null)
})
