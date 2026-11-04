// What a report says about a task run:  npm test  (in web-app)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reportTask } from '../src/utils/taskReport.js'

const session = (coverageTask, extra = {}) => ({
  persona_snapshot: { name: 'Thomas' },
  task: { goal: 'Buy the yearly plan', intents: ['find pricing page', 'add item to cart', 'reach checkout form'] },
  coverage: coverageTask === undefined ? {} : { task: coverageTask },
  ...extra
})

test('a report says the goal, every step in order, and which were reached', () => {
  const r = reportTask(session({ intents: 3, reached: 1, ended: 'failed' }))
  assert.equal(r.name, 'Thomas')
  assert.equal(r.goal, 'Buy the yearly plan')
  assert.deepEqual(r.steps, [
    { text: 'find pricing page', reached: true },
    { text: 'add item to cart', reached: false },
    { text: 'reach checkout form', reached: false }
  ])
  assert.equal(r.progressLine, 'Thomas reached 1 of 3 things on the list.')
})

test('when everything was reached every step says so and there is no extra line', () => {
  const r = reportTask(session({ intents: 3, reached: 3, ended: 'done' }))
  assert.ok(r.steps.every((s) => s.reached === true))
  assert.equal(r.progressLine, null)
})

test('when nothing was reached the steps are not marked and the line says so', () => {
  const r = reportTask(session({ intents: 3, reached: 0, ended: 'failed' }))
  assert.ok(r.steps.every((s) => s.reached === false))
  assert.equal(r.progressLine, 'Thomas did not reach any of the 3 things on the list.')
})

test('a run that stopped on a found link counts what was reached', () => {
  const r = reportTask(session({ intents: 3, reached: 2, ended: 'stopped' }))
  assert.deepEqual(r.steps.map((s) => s.reached), [true, true, false])
  assert.equal(r.progressLine, 'Thomas reached 2 of 3 things on the list.')
})

test('a walk that never ran marks nothing, because nothing is known', () => {
  for (const c of [{ intents: 3, reached: 0, ended: null }, undefined, { intents: 2, reached: 2, ended: 'done' }]) {
    const r = reportTask(session(c))
    assert.ok(r, 'the goal and the list are still shown')
    assert.ok(r.steps.every((s) => s.reached === null), JSON.stringify(c))
    assert.equal(r.progressLine, null)
  }
})

test('a session without a task, or with a damaged one, has nothing to show', () => {
  assert.equal(reportTask({ persona_snapshot: { name: 'David' }, coverage: {} }), null)
  assert.equal(reportTask(null), null)
  for (const bad of ['text', {}, { goal: 'g' }, { goal: 'g', intents: [] }, { goal: 'g', intents: ['a', 5] }, { goal: 4, intents: ['a'] }]) {
    assert.equal(reportTask(session(undefined, { task: bad })), null, JSON.stringify(bad))
  }
})

test('without a name the report still reads', () => {
  const r = reportTask(session({ intents: 3, reached: 1, ended: 'failed' }, { persona_snapshot: null }))
  assert.equal(r.name, 'This person')
  assert.equal(r.progressLine, 'This person reached 1 of 3 things on the list.')
})
