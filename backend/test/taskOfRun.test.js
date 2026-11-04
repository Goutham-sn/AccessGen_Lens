// What the run page's data says about a task (no database needed):
//   docker compose exec backend node --test test/taskOfRun.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { taskOf, taskProgress } from '../src/utils/taskOfRun.js'

test('the stored task comes back as the goal and the list', () => {
  const stored = { goal: 'Buy the plan', intents: ['find pricing page', 'add item to cart'] }
  assert.deepEqual(taskOf(stored), stored)
})

test('a run with no task has none', () => {
  assert.equal(taskOf(null), null)
  assert.equal(taskOf(undefined), null)
})

test('a stored task of the wrong shape is not passed on', () => {
  for (const bad of ['text', 7, [], {}, { goal: 'g' }, { goal: 'g', intents: 'a' }, { goal: 1, intents: ['a'] }, { goal: 'g', intents: ['a', 2] }]) {
    assert.equal(taskOf(bad), null, JSON.stringify(bad))
  }
})

test('only the goal and the list are passed on, whatever else is stored', () => {
  const out = taskOf({ goal: 'g', intents: ['a'], secret: 'x' })
  assert.deepEqual(Object.keys(out), ['goal', 'intents'])
})

test('how far a person got comes from the run coverage', () => {
  assert.deepEqual(taskProgress({ task: { intents: 3, reached: 2, ended: 'failed' } }), { reached: 2, intents: 3, ended: 'failed' })
  assert.deepEqual(taskProgress({ task: { intents: 1, reached: 0, ended: null } }), { reached: 0, intents: 1, ended: null }, 'the walk never ran')
})

test('no task result, no progress', () => {
  for (const c of [null, undefined, {}, { task: null }, { task: {} }, { task: { intents: '3', reached: 1 } }, { task: { intents: 3 } }]) {
    assert.equal(taskProgress(c), null, JSON.stringify(c))
  }
})
