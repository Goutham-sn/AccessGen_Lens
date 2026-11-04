// The one-line summary on a card:  npm test  (in web-app)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitFirstSentence } from '../src/utils/cardSummary.js'
import { PERSONA_CARDS } from '../src/data/personaCards.js'

test('the first sentence is split from the rest', () => {
  assert.deepEqual(splitFirstSentence('One. Two. Three.'), { first: 'One.', rest: 'Two. Three.' })
  assert.deepEqual(splitFirstSentence('Really? Yes! Fine.'), { first: 'Really?', rest: 'Yes! Fine.' })
})

test('a single sentence, or no full stop at all, is all first', () => {
  assert.deepEqual(splitFirstSentence('Only one.'), { first: 'Only one.', rest: '' })
  assert.deepEqual(splitFirstSentence('No stop here'), { first: 'No stop here', rest: '' })
  assert.deepEqual(splitFirstSentence(undefined), { first: '', rest: '' })
})

test('a name or number with a full stop inside does not end the sentence', () => {
  assert.deepEqual(splitFirstSentence('Version 2.5 is out. More follows.'), { first: 'Version 2.5 is out.', rest: 'More follows.' })
})

test('every card has a short first sentence and loses nothing when split', () => {
  for (const c of PERSONA_CARDS) {
    const { first, rest } = splitFirstSentence(c.story)
    assert.ok(first.length > 0 && first.length <= 100, `${c.id}: "${first}" is ${first.length} characters`)
    assert.equal(rest ? `${first} ${rest}` : first, c.story.trim(), c.id)
  }
})
