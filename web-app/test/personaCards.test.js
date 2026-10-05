// Card data checks for the /start page:  npm test  (in web-app)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { PERSONA_CARDS, getCard, fillPronouns } from '../src/data/personaCards.js'
import { getProfile } from '../src/data/profiles.js'
import { BUILT_IN_PERSONAS } from '../../backend/src/config/builtInPersonas.js'
import { RUNNER_PROFILES, allChecks } from '../../backend/src/config/runnerCapabilities.js'

const MODES = new Set(['automated', 'extension', 'later'])
const personaByName = new Map(BUILT_IN_PERSONAS.map((p) => [p.name, p]))

test('every card has a unique id, a known mode and a draft flag', () => {
  const ids = new Set()
  for (const c of PERSONA_CARDS) {
    assert.ok(!ids.has(c.id), `duplicate id ${c.id}`)
    ids.add(c.id)
    assert.ok(MODES.has(c.mode), `${c.id}: mode ${c.mode}`)
    assert.equal(typeof c.draft, 'boolean', `${c.id}: draft must be true or false`)
    assert.ok(c.name && c.story && c.howTheyUseTheWeb, `${c.id}: name, story and howTheyUseTheWeb are required`)
    if (c.kind === 'person') assert.ok(c.age && c.place && c.experience, `${c.id}: people need age, place and experience`)
  }
})

test('cards linked to a built-in persona match that persona', () => {
  for (const c of PERSONA_CARDS.filter((x) => x.personaName)) {
    const p = personaByName.get(c.personaName)
    assert.ok(p, `${c.id}: no built-in persona named ${c.personaName}`)
    assert.equal(c.age, p.age, `${c.id}: age differs from the persona`)
    for (const prof of c.profiles) {
      assert.ok(p.profiles.some((x) => x.id === prof.id), `${c.id}: ${prof.id} is not one of ${p.name}'s profiles`)
    }
  }
})

test('automated cards only use what the runner can simulate, and only known checks', () => {
  const checks = allChecks()
  for (const c of PERSONA_CARDS.filter((x) => x.mode === 'automated')) {
    for (const prof of c.profiles) assert.ok(RUNNER_PROFILES.has(prof.id), `${c.id}: the runner cannot simulate ${prof.id}`)
    for (const item of c.looksAt) assert.ok(checks.has(item.check), `${c.id}: unknown check ${item.check}`)
  }
})

test('extension cards only apply profiles the extension has', () => {
  for (const c of PERSONA_CARDS.filter((x) => x.mode === 'extension')) {
    assert.ok(c.profiles.length > 0, `${c.id}: no profiles to apply`)
    for (const prof of c.profiles) assert.ok(getProfile(prof.id), `${c.id}: unknown profile ${prof.id}`)
  }
})

test('every "see card" link points at a card that covers that profile', () => {
  for (const c of PERSONA_CARDS) {
    for (const line of c.notSimulated || []) {
      if (!line.seeCard) continue
      const target = getCard(line.seeCard)
      assert.ok(target, `${c.id}: links to missing card ${line.seeCard}`)
      assert.notEqual(target.mode, 'later', `${c.id}: links to a card that is not available yet`)
      assert.ok(target.profiles.some((p) => p.id === line.profile), `${c.id}: ${line.seeCard} does not cover ${line.profile}`)
    }
  }
})

test('guidelines have a name, a number and level A or AA', () => {
  for (const c of PERSONA_CARDS) {
    for (const g of c.guidelines || []) {
      assert.ok(g.name, `${c.id}: guideline without a name`)
      assert.match(g.number, /^\d\.\d{1,2}\.\d{1,2}$/, `${c.id}: ${g.name} number`)
      assert.ok(g.level === 'A' || g.level === 'AA', `${c.id}: ${g.name} level`)
    }
  }
})

// Coverage: each profile of each built-in persona is accounted for exactly
// once among that persona's cards. Either it is on exactly one of their
// cards, or (when on none) it appears in exactly one not-simulated line.
// A not-simulated line that links to the covering card is a pointer, not a
// second count.
test('every profile of every built-in persona appears on exactly one card or one not-simulated line', () => {
  const problems = []
  for (const persona of BUILT_IN_PERSONAS) {
    const cards = PERSONA_CARDS.filter((c) => c.personaName === persona.name)
    for (const { id } of persona.profiles) {
      const onCards = cards.filter((c) => (c.profiles || []).some((p) => p.id === id)).length
      const lines = cards.flatMap((c) => c.notSimulated || []).filter((l) => l.profile === id)
      const unlinkedLines = lines.filter((l) => !l.seeCard || !getCard(l.seeCard)?.profiles.some((p) => p.id === id))
      if (onCards > 1) problems.push(`${persona.name}: ${id} is on ${onCards} cards`)
      if (onCards === 1 && lines.some((l) => !l.seeCard)) problems.push(`${persona.name}: ${id} is on a card and also listed as not simulated`)
      if (onCards === 0 && lines.length !== 1) problems.push(`${persona.name}: ${id} is on no card and in ${lines.length} not-simulated lines`)
      if (onCards === 1 && unlinkedLines.length) problems.push(`${persona.name}: ${id} has a line that does not link to its card`)
    }
  }
  assert.deepEqual(problems, [])
})

// Every piece of card copy, flattened.
function copyOf(card) {
  return [card.story, card.howTheyUseTheWeb, ...(card.whatYouWillSee || []),
    ...(card.looksAt || []).map((i) => i.text), ...(card.notSimulated || []).map((l) => l.text)].filter(Boolean)
}

test('card copy has no bare pronouns, only the tokens filled from the persona', () => {
  const bare = /\b(he|him|his|she|her|hers|they|them|their|theirs)\b/i
  const tokens = /\{(\w+)\}/g
  for (const c of PERSONA_CARDS) {
    for (const text of copyOf(c)) {
      const withoutTokens = text.replace(tokens, '')
      assert.ok(!bare.test(withoutTokens), `${c.id}: bare pronoun in "${text}"`)
      for (const [, name] of text.matchAll(tokens)) {
        assert.ok(['they', 'them', 'their', 'Their'].includes(name), `${c.id}: unknown token {${name}}`)
      }
      assert.ok(!/\{they\} (?!can\b)/.test(text), `${c.id}: {they} only before "can", so the verb fits any pronoun`)
    }
  }
})

test('pronouns fill from the persona, and default to they/them/their', () => {
  const text = '{Their} hand shakes; it wears {them} out, and {they} can tell. {their} time.'
  assert.equal(fillPronouns(text, null), 'Their hand shakes; it wears them out, and they can tell. their time.')
  assert.equal(fillPronouns(text, { subject: 'she', object: 'her', possessive: 'her' }),
    'Her hand shakes; it wears her out, and she can tell. her time.')
})
