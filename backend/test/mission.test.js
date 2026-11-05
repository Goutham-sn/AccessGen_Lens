import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanGoal, cleanOutcome, missionComparison } from '../src/utils/mission.js'

test('a goal is trimmed, squashed and capped; an empty one is no mission', () => {
  assert.equal(cleanGoal('  Find   the returns policy \n'), 'Find the returns policy')
  assert.equal(cleanGoal('x'.repeat(300)).length, 200)
  assert.equal(cleanGoal('   '), null)
  assert.equal(cleanGoal(42), null)
})

test('only done or gave-up are outcomes, with a sane duration', () => {
  assert.deepEqual(cleanOutcome({ outcome: 'done', durationMs: 1234.6 }), { outcome: 'done', durationMs: 1235 })
  assert.deepEqual(cleanOutcome({ outcome: 'gave-up', durationMs: -5 }), { outcome: 'gave-up', durationMs: null })
  assert.equal(cleanOutcome({ outcome: 'won' }), null)
})

test('the comparison gives a ratio only when both runs were finished', () => {
  const as = { mission: { goal: 'g', outcome: 'done', durationMs: 42000 } }
  const you = { id: 'b', mission: { goal: 'g', outcome: 'done', durationMs: 12000 } }
  assert.equal(missionComparison(as, you).ratio, 3.5)
  assert.equal(missionComparison({ mission: { goal: 'g', outcome: 'gave-up', durationMs: 90000 } }, you).ratio, null)
  assert.equal(missionComparison(as, null).you, null)
  assert.equal(missionComparison({ mission: null }, you), null)
})
