// Page-derived text handling (no browser needed).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanPageText, pageName, groupedNames, focusLostToPageCopy, byHand } from '../src/copy.js'

test('markup in a name stays as text, untouched apart from length', () => {
  assert.equal(cleanPageText('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>')
})

test('control characters and direction overrides are removed, whitespace collapsed', () => {
  assert.equal(cleanPageText('Sign\u0000 in\n\tnow\u202E!'), 'Sign in now !')
  assert.equal(cleanPageText('  a \u0007 b  '), 'a b')
})

test('names are capped at 80 characters', () => {
  const long = 'x'.repeat(200)
  const out = cleanPageText(long)
  assert.equal(out.length, 80)
  assert.ok(out.endsWith('\u2026'))
})

test('an empty name reads as an unnamed role', () => {
  assert.equal(pageName('', 'button'), 'an unnamed button')
  assert.equal(pageName('   \u0000 ', 'link'), 'an unnamed link')
  assert.equal(pageName(null, ''), 'an unnamed element')
  assert.equal(pageName('Search', 'button'), 'Search')
})

const unnamed = (role) => ({ name: '', role })
const named = (name, role = 'link') => ({ name, role })

test('repeated unnamed elements are counted, in order of first appearance', () => {
  const { phrases, more } = groupedNames([
    unnamed('link'), unnamed('link'), named('Home'), unnamed('button'), unnamed('link'), named('Home'), unnamed('link')
  ])
  assert.deepEqual(phrases, ['4 unnamed links', '\u201CHome\u201D (2 times)', 'an unnamed button'])
  assert.equal(more, 0)
})

test('plurals of roles read right', () => {
  const { phrases } = groupedNames([
    unnamed('combo box'), unnamed('combo box'), unnamed('text field'), unnamed('text field'), unnamed('category'), unnamed('category')
  ])
  assert.deepEqual(phrases, ['2 unnamed combo boxes', '2 unnamed text fields', '2 unnamed categories'])
})

test('past 10 groups the rest are counted as more elements', () => {
  const items = Array.from({ length: 13 }, (_, i) => named(`Item ${i + 1}`))
  items.push(named('Item 12'), named('Item 13'))
  const { phrases, more } = groupedNames(items)
  assert.equal(phrases.length, 10)
  assert.equal(phrases[0], '\u201CItem 1\u201D')
  assert.equal(more, 5, 'Item 11, Item 12 (twice) and Item 13 (twice)')
})

test('names in a focus-lost fact are cleaned, capped at 80 characters and left as text', () => {
  const evil = '<img src=x onerror=alert(1)>'
  const long = 'x'.repeat(200)
  const { fact } = focusLostToPageCopy({
    persona: 'David', prevStep: 3, presses: 2, prev: named('Home'), next: named('Contact'),
    flashed: [named(`${evil}\u0000\u202E`), named(long), unnamed('link'), unnamed('link')]
  })
  assert.ok(fact.includes(`\u201C${evil}\u201D`), fact)
  assert.ok(!/[\u0000-\u001F\u202E]/.test(fact), 'no control or direction characters')
  assert.ok(fact.includes(`\u201C${'x'.repeat(79)}\u2026\u201D`), 'capped at 80 characters')
  assert.ok(fact.endsWith('and 2 unnamed links received focus and then lost it.'), fact)
  assert.ok(!fact.includes('\u2014'), 'no em dash')
})

test('the fact lists up to 10 names and then says how many more', () => {
  const flashed = Array.from({ length: 14 }, (_, i) => named(`Link ${i + 1}`))
  const { fact } = focusLostToPageCopy({ persona: 'David', prevStep: 1, presses: 14, prev: named('Home'), next: named('End'), flashed })
  assert.ok(fact.includes('\u201CLink 10\u201D and 4 more received focus and then lost it.'), fact)
  assert.ok(!fact.includes('Link 11'))
})

test('long way by hand: the row names the anchor used, and an unknown anchor fails loudly', () => {
  const ask = (anchor) => byHand.longWay({ press: 54, name: 'A Light in the Attic', role: 'link', anchor })
  assert.equal(ask('main'),
    'press Tab 54 times, look at “A Light in the Attic” (link). Is it the first stop inside the main landmark, with nothing before it that skips there?')
  assert.equal(ask('h1'),
    "press Tab 54 times, look at “A Light in the Attic” (link). Is it the first stop after the page's first heading, which is an h1, with nothing before it that skips there?")
  assert.throws(() => ask(undefined), /unknown long-way anchor/)
})
