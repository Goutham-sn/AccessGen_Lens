// Task Mode input, which profiles can run it, and how a task run reads in the
// report (no database needed):
//   docker compose exec backend node --test test/taskInput.test.js
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkTask } from '../src/utils/taskInput.js'
import { lookedAt, noMomentsText } from '../src/utils/lookedAt.js'
import { profilesForRun, TASK_LIMITS } from '../src/config/runnerCapabilities.js'

const good = { goal: 'Buy the plan', intents: ['find pricing page', 'add item to cart', 'reach checkout form'] }

test('no task means a regular run', () => {
  assert.deepEqual(checkTask(undefined), { task: null })
  assert.deepEqual(checkTask(null), { task: null })
})

test('a goal and a list of intents are accepted and tidied', () => {
  const r = checkTask({ goal: '  Buy   the plan ', intents: ['  find pricing\npage '] })
  assert.deepEqual(r, { task: { goal: 'Buy the plan', intents: ['find pricing page'] } })
  assert.deepEqual(checkTask(good), { task: good })
})

test('the number and length of intents are capped', () => {
  const max = TASK_LIMITS.intents
  assert.ok(checkTask({ goal: 'g', intents: Array(max).fill('find x') }).task)
  assert.match(checkTask({ goal: 'g', intents: Array(max + 1).fill('find x') }).error, /between 1 and 6/)
  assert.match(checkTask({ goal: 'g', intents: [] }).error, /between 1 and 6/)
  assert.ok(checkTask({ goal: 'g', intents: ['x'.repeat(TASK_LIMITS.intentChars)] }).task)
  assert.match(checkTask({ goal: 'g', intents: ['x'.repeat(TASK_LIMITS.intentChars + 1)] }).error, /up to 100 characters/)
  assert.match(checkTask({ goal: 'x'.repeat(TASK_LIMITS.goalChars + 1), intents: ['a'] }).error, /up to 200 characters/)
})

test('anything that is not plain text is refused', () => {
  const bad = [
    '', '   ', 42, null, {}, ['a'], '!!!',
    'find' + String.fromCharCode(0) + ' x',
    'find ' + String.fromCharCode(0x202E) + 'x',
    'find' + String.fromCharCode(0x200B) + 'x'
  ]
  for (const intent of bad) {
    assert.ok(checkTask({ goal: 'g', intents: [intent] }).error, `refused: ${JSON.stringify(intent)}`)
  }
  assert.ok(checkTask({ goal: String.fromCharCode(0x202E) + 'g', intents: ['a'] }).error)
  assert.ok(checkTask({ goal: '', intents: ['a'] }).error)
})

test('the wrong shape is refused with a plain message', () => {
  for (const raw of ['find pricing', ['a'], 7, { goal: 'g' }, { goal: 'g', intents: 'a' }, { intents: ['a'] }]) {
    const r = checkTask(raw)
    assert.ok(r.error && !r.task, `refused: ${JSON.stringify(raw)}`)
  }
})

test('a task run can use a keyboard, screen reader or tunnel vision persona; filters alone cannot', () => {
  const p = (...ids) => ids.map((id) => ({ id, severity: 2 }))
  assert.deepEqual(profilesForRun(p('tunnel-vision'), true).supported.map((x) => x.id), ['tunnel-vision'])
  assert.equal(profilesForRun(p('tunnel-vision'), true).ok, true)
  assert.equal(profilesForRun(p('screen-reader', 'deuteranopia'), true).supported.length, 2, 'filters still apply on camera')
  assert.equal(profilesForRun(p('deuteranopia'), true).ok, false, 'a colour filter says nothing about how the page is reached')
  assert.equal(profilesForRun(p('tremor'), true).ok, false)
})

test('a regular run does not gain tunnel vision', () => {
  const p = [{ id: 'tunnel-vision' }]
  assert.deepEqual(profilesForRun(p, false), { supported: [], ok: false })
  assert.equal(profilesForRun([{ id: 'keyboard-only' }], false).ok, true)
})

const taskSession = (coverage, extra = {}) => ({
  source: 'runner',
  processing_complete: true,
  persona_snapshot: { name: 'Meera' },
  active_profiles: [{ id: 'tunnel-vision' }],
  coverage: { presses: 7, task: { intents: 3, reached: 3, ended: 'done' }, ...coverage },
  ...extra
})

test('a task run says what it looked at, not a list of Tab checks', () => {
  const looked = lookedAt(taskSession({}), 0)
  assert.deepEqual(looked.items, ['Whether Meera can reach each of the 3 things on the list, using only Tab and, on a link or button, Enter'])
  assert.equal(looked.noItems, null)
})

test('a task run that reached everything says so, never "noticed nothing"', () => {
  assert.equal(lookedAt(taskSession({}), 0).zeroMoments, 'Meera reached all 3 things on the list, in order.')
  assert.equal(lookedAt(taskSession({ task: { intents: 1, reached: 1, ended: 'done' } }), 0).zeroMoments, 'Meera reached the thing on the list.')
})

test('a task run that did not reach everything is never summarised as a normal end', () => {
  const partial = taskSession({ task: { intents: 3, reached: 1, ended: 'failed' } })
  assert.equal(lookedAt(partial, 0).zeroMoments, null)
  const stopped = taskSession({ task: { intents: 3, reached: 2, ended: 'stopped' }, stoppedReason: 'We found it but did not press it. We stopped there.' })
  assert.equal(lookedAt(stopped, 0).zeroMoments, null)
  assert.equal(noMomentsText(stopped, 0), 'We found it but did not press it. We stopped there.')
})

test('a regular run is read exactly as before', () => {
  const regular = { source: 'runner', processing_complete: true, persona_snapshot: { name: 'David' }, active_profiles: [{ id: 'keyboard-only' }], coverage: { presses: 14 } }
  assert.match(lookedAt(regular, 0).zeroMoments, /We pressed Tab 14 times/)
})
