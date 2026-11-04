// Where a built-in person lands on /start:  npm test  (in web-app)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { landingFor } from '../src/utils/personaLanding.js'
import { PERSONA_CARDS } from '../src/data/personaCards.js'
import { BUILT_IN_PERSONAS } from '../../backend/src/config/builtInPersonas.js'

const yes = () => true
const no = () => false

test('a person with a Watch card they can take part in is chosen', () => {
  assert.deepEqual(landingFor('David', PERSONA_CARDS, yes), { action: 'choose', cardId: 'david-keyboard-colour' })
  assert.deepEqual(landingFor('Thomas', PERSONA_CARDS, yes), { action: 'choose', cardId: 'thomas-low-vision' })
})

test('a person with only an Explore card is shown, not chosen', () => {
  assert.deepEqual(landingFor('Ananya', PERSONA_CARDS, yes), { action: 'show', cardId: 'ananya-adhd-dyslexia' })
  assert.deepEqual(landingFor('Fatima', PERSONA_CARDS, yes), { action: 'show', cardId: 'fatima-deaf' })
})

test('with two cards, Watch wins when it can be chosen and Explore is shown when it cannot', () => {
  assert.deepEqual(landingFor('Ravi', PERSONA_CARDS, yes), { action: 'choose', cardId: 'ravi-low-vision' })
  assert.deepEqual(landingFor('Ravi', PERSONA_CARDS, no), { action: 'show', cardId: 'ravi-tremor' })
})

test('a Watch card that cannot be chosen, with no Explore card, is shown with its reason', () => {
  assert.deepEqual(landingFor('Meera', PERSONA_CARDS, no), { action: 'show', cardId: 'meera-low-vision' })
})

test('a name with no card goes nowhere in particular', () => {
  assert.equal(landingFor('Nobody', PERSONA_CARDS, yes), null)
  assert.equal(landingFor(undefined, PERSONA_CARDS, yes), null)
})

test('every built-in person on the Personas page has somewhere to land', () => {
  for (const p of BUILT_IN_PERSONAS) {
    assert.ok(landingFor(p.name, PERSONA_CARDS, yes), `${p.name} has no card on /start`)
    assert.ok(landingFor(p.name, PERSONA_CARDS, no), `${p.name} has no card on /start when they cannot be chosen`)
  }
})
