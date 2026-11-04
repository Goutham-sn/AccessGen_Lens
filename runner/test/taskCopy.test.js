// The words for a task that was not reached, and the row that records it
// (no browser, no database needed).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { taskNotFoundCopy, coverageLines } from '../src/copy.js'
import { TASK_FAILURE_REASONS } from '../src/task.js'
import { taskFailureValues } from '../src/store.js'

const base = {
  persona: 'Meera',
  profile: 'keyboard-only',
  intent: 'find pricing page',
  intentNumber: 1,
  intentCount: 1,
  stopsAttempted: 4,
  lastStop: { name: 'Contact', tag: 'a', role: null },
  missed: null,
  radiusPx: 300
}
const copyFor = (reason, extra = {}) => taskNotFoundCopy({ ...base, reason, ...extra })
const words = (c) => `${c.headline} ${c.fact} ${c.forTeam}`

test('every reason has words, except the time limit, which is ours and not the persona’s', () => {
  for (const reason of TASK_FAILURE_REASONS) {
    const c = copyFor(reason)
    if (reason === 'budget-time') {
      assert.equal(c, null)
    } else {
      assert.ok(c.headline && c.fact && c.forTeam, `${reason} has all three`)
      assert.ok(c.headline.startsWith('Meera') || c.headline.includes('Meera'), `${reason} names the persona`)
    }
  }
  assert.equal(copyFor('something-new'), null)
})

test('the structured layer does not leak into the words', () => {
  const banned = /budget-|nothing-focusable|trapped|wrapped|task_failures|WCAG|violation|failure|failed|error|score|selector/i
  for (const reason of TASK_FAILURE_REASONS) {
    for (const extra of [{}, { missed: { stop: { name: 'Pricing', tag: 'a', role: null, press: 2 } } }, { intentNumber: 2, intentCount: 4 }]) {
      const c = copyFor(reason, extra)
      if (c) assert.doesNotMatch(words(c), banned, `${reason}: ${words(c)}`)
    }
  }
})

test('no pronouns, only the name', () => {
  for (const reason of TASK_FAILURE_REASONS) {
    const c = copyFor(reason, { missed: reason === 'wrapped' ? { stop: { name: 'Pricing', tag: 'a', role: null, press: 2 } } : null })
    if (c) assert.doesNotMatch(words(c), /\b(he|she|they|his|her|their|him|them|hers|theirs)\b/i)
  }
})

test('a place that was gone round says what was looked for and where it ended', () => {
  const c = copyFor('wrapped')
  assert.equal(c.headline, 'Meera would not find “find pricing page”.')
  assert.match(c.fact, /Tab went through 4 stops and came back to where it started without reaching it\./)
  assert.match(c.fact, /The last stop was “Contact” \(link\)\./)
  assert.doesNotMatch(c.fact, /step/i, 'a single intent has no step')
})

test('where an intent sits in the list is said, with what came before', () => {
  assert.match(copyFor('wrapped', { intentNumber: 1, intentCount: 4 }).fact, /It was step 1 of 4\.$/)
  assert.match(copyFor('wrapped', { intentNumber: 2, intentCount: 4 }).fact, /It was step 2 of 4\. The step before it was reached\.$/)
  assert.match(copyFor('wrapped', { intentNumber: 4, intentCount: 4 }).fact, /It was step 4 of 4\. The 3 steps before it were reached\.$/)
})

test('a screen reader listens, the others look', () => {
  assert.match(copyFor('wrapped', { profile: 'screen-reader' }).fact, /Meera listened for/)
  assert.match(copyFor('wrapped').fact, /Meera looked for/)
})

test('a place that matched but was out of sight is named, with the distance measured', () => {
  const c = copyFor('wrapped', { profile: 'tunnel-vision', missed: { stop: { name: 'Pricing', tag: 'a', role: null, press: 2 } } })
  assert.equal(c.headline, 'Meera would not notice “Pricing” when Tab reached it.')
  assert.match(c.fact, /Press 2 reached “Pricing” \(link\), which matches it\./)
  assert.match(c.fact, /more than 300 px from the middle of the screen and from the stop before it/)
})

test('an unnamed last stop reads as unnamed', () => {
  const c = copyFor('wrapped', { lastStop: { name: '', tag: 'button', role: null } })
  assert.match(c.fact, /The last stop was an unnamed button\./)
})

test('text from the person who set the goal and from the page is cleaned', () => {
  const c = copyFor('wrapped', {
    intent: 'find' + String.fromCharCode(0) + ' pricing' + String.fromCharCode(0x202E) + ' page',
    lastStop: { name: 'Con\u0007tact', tag: 'a', role: null }
  })
  assert.ok(c.headline.includes('“find pricing page”'))
  assert.ok([...words(c)].every((ch) => ch.charCodeAt(0) > 31 && !(ch.charCodeAt(0) >= 0x202A && ch.charCodeAt(0) <= 0x202E)))
})

test('with nothing reached there is no last stop to name', () => {
  const c = copyFor('nothing-focusable', { lastStop: null, stopsAttempted: 0 })
  assert.doesNotMatch(c.fact, /last stop/)
})

test('coverage lines for the time limit and for a place that was found but not pressed', () => {
  assert.equal(coverageLines.taskOutOfTime('find pricing page'),
    'We ran out of time while looking for “find pricing page”, so we do not know whether it can be reached.')
  assert.match(coverageLines.taskNotFollowed('find pricing page', 'leaves-site'), /because it leads to another site\. We stopped there\.$/)
  assert.match(coverageLines.taskNotFollowed('add item to cart', 'submits-form'), /because it would send a form\./)
  assert.match(coverageLines.taskNotFollowed('x', 'something-else'), /we only follow links on the same site/)
})

test('a task_failures row takes its values in column order', () => {
  const failure = {
    intent: 'find pricing page', intentIndex: 2, profile: 'tunnel-vision', reason: 'wrapped',
    lastStop: { name: 'About', tag: 'a' }, missed: { stop: { name: 'Pricing' }, score: 1 }, stopsAttempted: 4, elapsedMs: 812.6
  }
  assert.deepEqual(taskFailureValues('sess-1', failure, 'moment-1'), [
    'sess-1', 'moment-1', 2, 'find pricing page', 'tunnel-vision', 'wrapped',
    JSON.stringify({ name: 'About', tag: 'a' }), JSON.stringify({ stop: { name: 'Pricing' }, score: 1 }), 4, 813
  ])
  // No moment, no last stop, nothing missed: all null, not missing.
  const bare = taskFailureValues('sess-1', { ...failure, lastStop: null, missed: null }, undefined)
  assert.equal(bare[1], null)
  assert.equal(bare[6], null)
  assert.equal(bare[7], null)
  assert.equal(taskFailureValues('sess-1', { ...failure, missed: undefined }, null)[7], null)
})
