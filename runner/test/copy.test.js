// Page-derived text handling (no browser needed).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cleanPageText, pageName } from '../src/copy.js'

test('markup in a name stays as text, untouched apart from length', () => {
  assert.equal(cleanPageText('<img src=x onerror=alert(1)>'), '<img src=x onerror=alert(1)>')
})

test('control characters and direction overrides are removed, whitespace collapsed', () => {
  assert.equal(cleanPageText('Sign\u0000 in\n\tnow‮!'), 'Sign in now !')
  assert.equal(cleanPageText('  a \u0007 b  '), 'a b')
})

test('names are capped at 80 characters', () => {
  const long = 'x'.repeat(200)
  const out = cleanPageText(long)
  assert.equal(out.length, 80)
  assert.ok(out.endsWith('…'))
})

test('an empty name reads as an unnamed role', () => {
  assert.equal(pageName('', 'button'), 'an unnamed button')
  assert.equal(pageName('   \u0000 ', 'link'), 'an unnamed link')
  assert.equal(pageName(null, ''), 'an unnamed element')
  assert.equal(pageName('Search', 'button'), 'Search')
})
