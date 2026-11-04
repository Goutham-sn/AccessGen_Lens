// The "something to find" form's checks and words:  npm test  (in web-app)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyTask, loadTask, checkTaskForm, canFindThings, taskCardLines, taskProgressLine } from '../src/utils/taskForm.js'
import { checkTask } from '../../backend/src/utils/taskInput.js'
import { TASK_LIMITS, TASK_PROFILES } from '../../backend/src/config/runnerCapabilities.js'

const limits = TASK_LIMITS

test('a goal and a list are accepted and tidied, and empty rows are ignored', () => {
  const r = checkTaskForm({ goal: '  Buy   the plan ', intents: ['find pricing page', '', '   ', ' add item  to cart '] }, limits)
  assert.deepEqual(r, { task: { goal: 'Buy the plan', intents: ['find pricing page', 'add item to cart'] } })
})

test('the form and the server agree on what is accepted', () => {
  const cases = [
    { goal: 'g', intents: ['find x'] },
    { goal: 'g', intents: Array(limits.intents).fill('find x') },
    { goal: 'g', intents: Array(limits.intents + 1).fill('find x') },
    { goal: 'x'.repeat(limits.goalChars), intents: ['a'] },
    { goal: 'x'.repeat(limits.goalChars + 1), intents: ['a'] },
    { goal: 'g', intents: ['x'.repeat(limits.intentChars)] },
    { goal: 'g', intents: ['x'.repeat(limits.intentChars + 1)] },
    { goal: 'g', intents: ['!!!'] },
    { goal: 'g', intents: ['find' + String.fromCharCode(0x200B) + 'x'] },
    { goal: 'g' + String.fromCharCode(0x202E), intents: ['a'] },
    { goal: '', intents: ['a'] },
    { goal: 'g', intents: [] }
  ]
  for (const c of cases) {
    const here = checkTaskForm(c, limits)
    // The server never sees rows the form dropped as empty.
    const sent = { goal: c.goal, intents: c.intents.filter((t) => t.trim()) }
    const there = checkTask(sent)
    assert.equal(Boolean(here.task), Boolean(there.task), `${JSON.stringify(c).slice(0, 80)}: form ${here.error || 'ok'}, server ${there.error || 'ok'}`)
    if (here.task) assert.deepEqual(here.task, there.task)
  }
})

test('an error says which field needs fixing, with a plain message', () => {
  assert.deepEqual(checkTaskForm({ goal: '', intents: ['a'] }, limits).field, 'goal')
  assert.equal(checkTaskForm({ goal: 'g', intents: ['', ''] }, limits).field, 'intents')
  const second = checkTaskForm({ goal: 'g', intents: ['fine', 'x'.repeat(limits.intentChars + 1)] }, limits)
  assert.equal(second.field, 1, 'the position in the list as written, empty rows counted')
  assert.match(second.error, /100 characters or fewer/)
  const third = checkTaskForm({ goal: 'g', intents: ['', '', '???'] }, limits)
  assert.equal(third.field, 2)
  assert.doesNotMatch(third.error, /invalid|error|violation|fail/i)
})

test('without the limits from the server nothing is sent', () => {
  const r = checkTaskForm({ goal: 'g', intents: ['a'] }, undefined)
  assert.ok(r.error && !r.task)
})

test('what was kept in the browser is read back safely', () => {
  assert.deepEqual(loadTask(undefined), emptyTask())
  assert.deepEqual(loadTask('x'), emptyTask())
  assert.deepEqual(loadTask({ on: 'yes', goal: 5, intents: 'no' }), emptyTask())
  assert.deepEqual(loadTask({ on: true, goal: 'g', intents: ['a', 3, 'b'] }), { on: true, goal: 'g', intents: ['a', 'b'] })
  assert.equal(loadTask({ intents: Array(100).fill('a') }).intents.length, 20)
})

test('a person can take part when one of their profiles can drive the walk', () => {
  const profiles = [...TASK_PROFILES]
  assert.equal(canFindThings(['keyboard-only', 'deuteranopia'], profiles), true)
  assert.equal(canFindThings(['tunnel-vision', 'tremor', 'low-vision'], profiles), true)
  assert.equal(canFindThings(['low-vision', 'tremor', 'macular-degeneration'], profiles), false)
  assert.equal(canFindThings(['keyboard-only'], undefined), false)
})

test('the card says what a run with something to find looks at, and that it never types or sends', () => {
  const sighted = taskCardLines('David', ['keyboard-only', 'deuteranopia'])
  assert.match(sighted.looks[0], /^Whether David can reach each thing on your list, in order, using only Tab and, on a link or button, Enter$/)
  assert.match(sighted.looks[1], /The words on the page, as David would read them/)
  assert.match(taskCardLines('James', ['screen-reader', 'keyboard-only']).looks[1], /announce/)
  assert.match(taskCardLines('Thomas', ['tremor', 'tunnel-vision', 'low-vision']).looks[1], /middle of the screen and near the place Thomas was just at/)
  assert.match(sighted.not[0], /never does these/)
  assert.match(sighted.not[1], /do not run when there is something to find/)
})

test('the words stay human: no guideline numbers or verdicts', () => {
  const text = JSON.stringify([taskCardLines('Meera', ['keyboard-only']), checkTaskForm({ goal: '', intents: [] }, limits)])
  assert.doesNotMatch(text, /WCAG|\d\.\d\.\d|violation|fail|invalid/i)
})

test('how far a person got is said only when the walk ran and something was not reached', () => {
  const line = (reached, intents, ended = 'failed') => taskProgressLine('Meera', { reached, intents, ended })
  assert.equal(line(2, 3), 'Meera reached 2 of 3 things on the list.')
  assert.equal(line(0, 3), 'Meera did not reach any of the 3 things on the list.')
  assert.equal(line(0, 1), 'Meera did not reach the thing on the list.')
  assert.equal(line(3, 3, 'done'), null, 'everything reached: the run page already says so')
  assert.equal(line(0, 3, null), null, 'the walk never ran, so reached means nothing')
  assert.equal(taskProgressLine('Meera', null), null)
})
