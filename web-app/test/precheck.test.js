// The pre-check's words and its client:  npm test  (in web-app)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { signalsForCard, precheckNotes, precheckStatusLine } from '../src/utils/precheckNotes.js'
import { requestPrecheck } from '../src/services/precheckClient.js'
import { PERSONA_CARDS } from '../src/data/personaCards.js'
import { PRECHECK_SIGNALS } from '../../backend/src/config/runnerCapabilities.js'
import { BUILT_IN_PERSONAS } from '../../backend/src/config/builtInPersonas.js'

const signals = PRECHECK_SIGNALS
const idsOf = (cardId) => PERSONA_CARDS.find((c) => c.id === cardId).profiles.map((p) => p.id)
const personaIds = (name) => BUILT_IN_PERSONAS.find((p) => p.name === name).profiles.map((p) => p.id)

// A good look, with each signal given or left at "plenty of it".
function look(over = {}) {
  return {
    ok: true,
    checkedAt: '2026-11-01T10:00:00.000Z',
    reachableStops: { count: 57, level: 'plenty' },
    textAmount: { chars: 4000, level: 'plenty' },
    colourChange: { share: 0.2, level: 'lots' },
    unseenStops: { count: 9, of: 57, level: 'some' },
    ...over
  }
}
const ok = (count, level) => ({ ok: true, checkedAt: '2026-11-01T10:00:00.000Z', reachableStops: { count, level } })
const textsFor = (name, ids, result) => precheckNotes(name, ids, signals, result).map((n) => n.text)

// ---- which cards hear about which signal

test('in a regular run, David hears about stops and colour, James about stops, Meera, Thomas and Ravi about text', () => {
  const signalsOf = (id) => signalsForCard(idsOf(id), signals).sort()
  assert.deepEqual(signalsOf('david-keyboard-colour'), ['colour-change', 'reachable-stops'])
  assert.deepEqual(signalsOf('james-screen-reader'), ['reachable-stops'])
  for (const id of ['meera-low-vision', 'thomas-low-vision', 'ravi-low-vision']) assert.deepEqual(signalsOf(id), ['text-amount'], id)
})

test('the cards that are explored, not watched, and the ones to come hear about nothing', () => {
  for (const c of PERSONA_CARDS.filter((x) => x.mode !== 'automated')) {
    assert.deepEqual(signalsForCard((c.profiles || []).map((p) => p.id), signals), [], c.id)
  }
})

test('in a run with something to find, Thomas also hears about tunnel vision, which only that run simulates', () => {
  assert.deepEqual(signalsForCard(personaIds('Thomas'), signals).sort(), ['text-amount', 'unseen-stops'])
  assert.ok(!signalsForCard(idsOf('thomas-low-vision'), signals).includes('unseen-stops'), 'a regular run does not simulate tunnel vision')
  assert.deepEqual(signalsForCard(personaIds('David'), signals).sort(), ['colour-change', 'reachable-stops'])
  assert.deepEqual(signalsForCard(personaIds('James'), signals).sort(), ['reachable-stops'])
})

test('all five of David, James, Meera, Thomas and Ravi hear about something', () => {
  for (const [name, id] of [['David', 'david-keyboard-colour'], ['James', 'james-screen-reader'], ['Meera', 'meera-low-vision'], ['Thomas', 'thomas-low-vision'], ['Ravi', 'ravi-low-vision']]) {
    assert.ok(signalsForCard(idsOf(id), signals).length > 0, name)
  }
})

// ---- the sentences, each in plain words with the person named

test('stops: none and few', () => {
  assert.deepEqual(textsFor('David', idsOf('david-keyboard-colour'), look({ colourChange: { share: 0.2, level: 'lots' }, reachableStops: { count: 0, level: 'none' } })),
    ['On this page, David would have nothing to land on with Tab: no link, button or field can be reached.'])
  assert.deepEqual(textsFor('James', idsOf('james-screen-reader'), look({ reachableStops: { count: 3, level: 'few' } })),
    ['On this page, James would find few places to land on with Tab: only 3.'])
  assert.deepEqual(textsFor('James', idsOf('james-screen-reader'), look({ reachableStops: { count: 1, level: 'few' } })),
    ['On this page, James would find few places to land on with Tab: only one.'])
})

test('text: almost none, and little with about how many words', () => {
  assert.deepEqual(textsFor('Meera', idsOf('meera-low-vision'), look({ textAmount: { chars: 2, level: 'none' } })),
    ['On this page, Meera would find almost no text to read.'])
  assert.deepEqual(textsFor('Ravi', idsOf('ravi-low-vision'), look({ textAmount: { chars: 412, level: 'little' } })),
    ['On this page, Ravi would find little text to read: about 70 words.'])
  assert.deepEqual(textsFor('Ravi', idsOf('ravi-low-vision'), look({ textAmount: { chars: 30, level: 'little' } })),
    ['On this page, Ravi would find little text to read: about 10 words.'], 'never claims fewer than ten')
})

test('colour: only when little changes, said about the colours the person sees', () => {
  assert.deepEqual(textsFor('David', idsOf('david-keyboard-colour'), look({ colourChange: { share: 0.004, level: 'little' } })),
    ['On this page, little changes in the colours David sees: nearly everything on screen looks the same as it does to other people.'])
  for (const level of ['some', 'lots']) assert.deepEqual(textsFor('David', idsOf('david-keyboard-colour'), look({ colourChange: { share: 0.2, level } })), [], level)
})

test('tunnel vision: graded by how many places are out of view, only in a run that simulates it', () => {
  const gaps = (count, of, level) => look({ unseenStops: { count, of, level } })
  const forThomas = (result) => textsFor('Thomas', personaIds('Thomas'), result).filter((t) => /Tab/.test(t))
  assert.deepEqual(forThomas(gaps(0, 4, 'none')),
    ['On this page, Thomas would be able to make out every place Tab lands on: each is near the middle of the screen or near the last place.'])
  assert.deepEqual(forThomas(gaps(1, 4, 'few')), ['On this page, Thomas would have little to miss: only 1 of the 4 places Tab reaches sits out of view.'])
  assert.deepEqual(forThomas(gaps(3, 12, 'few')), ['On this page, Thomas would have little to miss: only 3 of the 12 places Tab reaches sit out of view.'])
  assert.deepEqual(forThomas(gaps(1, 1, 'few')), ['On this page, Thomas would have little to miss: the one place Tab reaches sits out of view.'])
  assert.deepEqual(forThomas(gaps(11, 57, 'lots')), ['On this page, Thomas would have a lot to miss: 11 of 57 places Tab reaches sit out of view.'])
  assert.deepEqual(forThomas(gaps(17, 230, 'lots')), ['On this page, Thomas would have a lot to miss: 17 of 230 places Tab reaches sit out of view.'])
  // the middle band, and a look that was not sure, say nothing
  for (const level of ['some', 'unsure']) assert.deepEqual(forThomas(gaps(5, 20, level)), [], level)
  // a regular run does not simulate tunnel vision, so no note for any level
  for (const level of ['none', 'few', 'lots']) assert.deepEqual(textsFor('Thomas', idsOf('thomas-low-vision'), gaps(11, 57, level)), [], level)
})

test('a page with plenty of everything says nothing, and neither does a look that did not work', () => {
  for (const [name, ids] of [['David', idsOf('david-keyboard-colour')], ['James', idsOf('james-screen-reader')], ['Meera', idsOf('meera-low-vision')], ['Thomas', personaIds('Thomas')]]) {
    assert.deepEqual(textsFor(name, ids, look()), [], name)
  }
  assert.deepEqual(precheckNotes('David', idsOf('david-keyboard-colour'), signals, { ok: false, reason: 'x' }), [])
  assert.deepEqual(precheckNotes('David', idsOf('david-keyboard-colour'), signals, null), [])
  assert.deepEqual(precheckNotes('David', idsOf('david-keyboard-colour'), undefined, look({ reachableStops: { count: 0, level: 'none' } })), [], 'the server named no signals')
})

test('a result missing a signal (an older one) just has no note for it', () => {
  const old = { ok: true, checkedAt: 'x', reachableStops: { count: 0, level: 'none' } }
  assert.equal(textsFor('David', idsOf('david-keyboard-colour'), old).length, 1)
  assert.deepEqual(textsFor('Meera', idsOf('meera-low-vision'), old), [])
})

test('David can have two notes, in a fixed order', () => {
  const notes = precheckNotes('David', idsOf('david-keyboard-colour'), signals, look({
    reachableStops: { count: 1, level: 'few' }, colourChange: { share: 0, level: 'little' }
  }))
  assert.deepEqual(notes.map((n) => n.signal), ['reachable-stops', 'colour-change'])
})

test('the words are about what is on the page, never about quality: no verdicts, no guideline numbers, no pronouns', () => {
  const worst = look({
    reachableStops: { count: 0, level: 'none' }, textAmount: { chars: 2, level: 'none' },
    colourChange: { share: 0, level: 'little' }, unseenStops: { count: 0, of: 4, level: 'none' }
  })
  const lines = [
    ...['David', 'James', 'Meera', 'Ravi'].flatMap((n) => textsFor(n, personaIds(n), worst)),
    ...textsFor('Thomas', personaIds('Thomas'), worst),
    ...textsFor('Thomas', personaIds('Thomas'), look({ unseenStops: { count: 1, of: 4, level: 'few' } })),
    ...textsFor('Thomas', personaIds('Thomas'), look({ unseenStops: { count: 11, of: 57, level: 'lots' } })),
    precheckStatusLine({ status: 'checking' }),
    precheckStatusLine({ status: 'done', result: worst })
  ].join(' ')
  assert.ok(lines.length > 200)
  assert.doesNotMatch(lines, /WCAG|\d\.\d\.\d|violation|fail|invalid|error|wrong|bad|poor|contrast|\b(he|she|his|her|they|their)\b/i)
})

test('the line above the cards follows the check', () => {
  assert.equal(precheckStatusLine({ status: 'idle' }), null)
  assert.equal(precheckStatusLine(null), null)
  assert.equal(precheckStatusLine({ status: 'checking' }), 'Checking this page…')
  assert.equal(precheckStatusLine({ status: 'done', result: look() }), 'Checked this page ahead of time.')
  assert.equal(precheckStatusLine({ status: 'done', result: { ok: false, reason: 'We could not open this page.' } }), 'We could not open this page.')
})

// ---- the client

function fakeApi(script) {
  const calls = []
  return {
    calls,
    async post(path, body) { calls.push(['POST', path, body]); return script.shift() },
    async get(path) { calls.push(['GET', path]); return script.shift() }
  }
}
const quick = { sleep: async () => {}, intervalMs: 1 }

test('an answer from the cache needs no polling', async () => {
  const api = fakeApi([{ status: 'done', result: ok(3, 'few') }])
  assert.deepEqual(await requestPrecheck(api, 'https://example.com/', quick), ok(3, 'few'))
  assert.deepEqual(api.calls, [['POST', '/runs/precheck', { url: 'https://example.com/' }]])
})

test('a queued check is polled until it is done', async () => {
  const api = fakeApi([{ id: 'abc', status: 'checking' }, { status: 'checking' }, { status: 'checking' }, { status: 'done', result: ok(0, 'none') }])
  assert.deepEqual(await requestPrecheck(api, 'https://example.com/', quick), ok(0, 'none'))
  assert.deepEqual(api.calls.map((c) => c[0] + ' ' + c[1]), ['POST /runs/precheck', 'GET /runs/precheck/abc', 'GET /runs/precheck/abc', 'GET /runs/precheck/abc'])
})

test('when the person moves on, polling stops and nothing is returned', async () => {
  let current = true
  const api = fakeApi([{ id: 'abc', status: 'checking' }, { status: 'checking' }, { status: 'done', result: ok(1, 'few') }])
  const got = await requestPrecheck(api, 'https://example.com/', { ...quick, isCurrent: () => current, sleep: async () => { current = false } })
  assert.equal(got, null)
  assert.equal(api.calls.length, 1, 'no further requests')
  // and an answer that arrives after they moved on is dropped
  let c2 = true
  const api2 = fakeApi([{ status: 'done', result: ok(1, 'few') }])
  const post = api2.post.bind(api2)
  api2.post = async (...a) => { const r = await post(...a); c2 = false; return r }
  assert.equal(await requestPrecheck(api2, 'https://example.com/', { ...quick, isCurrent: () => c2 }), null)
})

test('a check that never finishes gives up with a plain line', async () => {
  let t = 0
  const api = fakeApi([{ id: 'abc', status: 'checking' }, ...Array(50).fill({ status: 'checking' })])
  const result = await requestPrecheck(api, 'https://example.com/', { ...quick, now: () => (t += 4000), giveUpMs: 15000 })
  assert.deepEqual(result, { ok: false, reason: 'The check took too long.' })
})

test('a refusal from the server (a limit, a bad address) is passed on as its own words', async () => {
  const api = { async post() { throw new Error('A check is already in progress. Please wait a moment.') } }
  await assert.rejects(requestPrecheck(api, 'https://example.com/', quick), /already in progress/)
})
