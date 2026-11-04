// Persona records, snapshots and the landing teaser:  npm test  (in web-app)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isUuid, personaIdOf, snapshotOf, inCardOrder } from '../src/utils/personaRecord.js'
import { teaserPeople, teaserLine } from '../src/utils/landingTeaser.js'
import { splitFirstSentence } from '../src/utils/cardSummary.js'
import { PERSONA_CARDS, avatarColorFor, personCard } from '../src/data/personaCards.js'
import { BUILT_IN_PERSONAS } from '../../backend/src/config/builtInPersonas.js'

const ID = '3f2b8c1e-9a4d-4e57-8b6a-1c2d3e4f5a6b'

test('only a real database id links a session to a persona', () => {
  assert.equal(isUuid(ID), true)
  assert.equal(isUuid('david-38'), false)
  assert.equal(isUuid(undefined), false)
  assert.equal(personaIdOf({ id: ID }), ID)
  assert.equal(personaIdOf({ id: 'david-38' }), null, 'a persona kept in the browser from before real ids')
  assert.equal(personaIdOf(null), null)
})

test('a snapshot has the same five fields the runner stores, and nothing else', () => {
  const record = { id: ID, name: 'Thomas', age: 51, story: 'A story.', profiles: [{ id: 'tremor', severity: 2 }],
    pronouns: { subject: 'he', object: 'him', possessive: 'his' }, is_built_in: true, illustrationColor: '#B7E8C9', location: 'Dublin' }
  assert.deepEqual(snapshotOf(record), { id: ID, name: 'Thomas', age: 51, story: 'A story.', profiles: [{ id: 'tremor', severity: 2 }] })
  assert.deepEqual(Object.keys(snapshotOf(record)).sort(), ['age', 'id', 'name', 'profiles', 'story'])
  assert.equal(snapshotOf(null), null)
  assert.deepEqual(snapshotOf({ id: 'meera-72', name: 'Meera' }), { id: null, name: 'Meera', age: null, story: null, profiles: [] })
})

test('people are put in the order of their cards, anyone without a card last', () => {
  const records = [{ name: 'Zed' }, { name: 'James' }, { name: 'David' }, { name: 'Fatima' }]
  assert.deepEqual(inCardOrder(records, PERSONA_CARDS).map((r) => r.name), ['David', 'James', 'Fatima', 'Zed'])
})

test('every card of a built-in person carries the same avatar colour, and the people have distinct ones', () => {
  const colours = new Map()
  for (const c of PERSONA_CARDS.filter((x) => x.personaName)) {
    assert.match(c.avatarColor, /^#[0-9A-F]{6}$/i, `${c.id}: avatarColor`)
    if (colours.has(c.personaName)) assert.equal(c.avatarColor, colours.get(c.personaName), `${c.id}: differs from the person's other card`)
    colours.set(c.personaName, c.avatarColor)
  }
  assert.equal(new Set(colours.values()).size, colours.size, 'two people share a colour')
  for (const p of BUILT_IN_PERSONAS) assert.ok(avatarColorFor(p.name), `${p.name} has no avatar colour`)
  assert.equal(avatarColorFor('Nobody'), null)
  assert.equal(personCard('Ravi').id, 'ravi-low-vision', 'the first card of a person')
})

test('the landing teaser is four different people from the cards, with no pronoun left unfilled', () => {
  const people = teaserPeople(PERSONA_CARDS)
  assert.equal(people.length, 4)
  assert.equal(new Set(people.map((p) => p.name)).size, 4)
  for (const p of people) {
    assert.ok(p.age && p.place && p.color, `${p.name}: age, place and colour`)
    assert.doesNotMatch(p.bio, /\{|\}/, `${p.name}: unfilled token`)
    assert.ok(PERSONA_CARDS.some((c) => c.personaName === p.name && c.story.startsWith(p.bio)), `${p.name}: bio is the card's own first sentence`)
  }
})

test('every built-in person has a one-line bio that needs no pronoun, so anyone can be in the teaser', () => {
  for (const p of BUILT_IN_PERSONAS) {
    const { first } = splitFirstSentence(personCard(p.name).story)
    assert.doesNotMatch(first, /\{\w+\}/, `${p.name}: "${first}"`)
  }
  assert.deepEqual(teaserPeople(PERSONA_CARDS).map((p) => p.name), ['David', 'James', 'Meera', 'Thomas'])
})

test('a bio that does need a pronoun is still skipped, rather than shown unfilled', () => {
  const cards = [
    { kind: 'person', personaName: 'A', story: 'Needs {their} hat. More.', age: 1, place: 'x', avatarColor: '#000000' },
    { kind: 'person', personaName: 'B', story: 'Plain bio. More.', age: 2, place: 'y', avatarColor: '#111111' }
  ]
  assert.deepEqual(teaserPeople(cards).map((p) => p.name), ['B'])
})

test('the line above the teaser says what is shown', () => {
  assert.equal(teaserLine(PERSONA_CARDS, 4), 'Four of the seven people you can choose, each experiencing the same page very differently.')
  assert.equal(teaserPeople(PERSONA_CARDS, 7).length, 7, 'all seven can be shown')
  assert.equal(teaserLine(PERSONA_CARDS, 7), 'Seven people, seven very different ways of experiencing the same page.')
})

test('the people with gendered stories have pronouns that match; the rest stay unset', () => {
  const gendered = /\b(he|she|his|her|hers|him)\b/i
  const expected = { she: ['she', 'her', 'her'], he: ['he', 'him', 'his'] }
  for (const p of BUILT_IN_PERSONAS) {
    const word = (p.story.match(gendered) || [])[0]?.toLowerCase()
    if (!word) { assert.equal(p.pronouns, null, `${p.name}: no gendered word in the story, so pronouns stay null`); continue }
    const kind = ['she', 'her', 'hers'].includes(word) ? 'she' : 'he'
    assert.deepEqual([p.pronouns?.subject, p.pronouns?.object, p.pronouns?.possessive], expected[kind], `${p.name}: story says "${word}"`)
  }
})
