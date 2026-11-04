// How a stop is scored against an intent (no browser needed).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { scoreStop, primaryProfile, perceptionFor } from '../src/task.js'

const viewport = { width: 1280, height: 720 }
const rectAt = (x, y, width = 100, height = 30) => ({ x, y, width, height })

const link = (text, extra = {}) => ({
  kind: 'element', tag: 'a', role: null, selector: 'a', name: text, rect: rectAt(600, 340),
  visibleText: text, accessibleName: text, landmarks: [], ...extra
})
const field = (label, landmarks) => ({
  kind: 'element', tag: 'input', role: null, selector: 'input', name: label, rect: rectAt(600, 340),
  visibleText: label, accessibleName: label, landmarks
})

const reading = { profileIds: ['keyboard-only'], viewport }
const hearing = { profileIds: ['screen-reader'], viewport }
const narrow = (previousCentre = null) => ({ profileIds: ['tunnel-vision'], viewport, previousCentre })

test('a link named for the intent scores full, an unrelated one scores nothing', () => {
  assert.equal(scoreStop(link('Pricing'), 'find pricing page', reading).score, 1)
  assert.equal(scoreStop(link('About'), 'find pricing page', reading).score, 0)
})

test('a longer or plural label for the same thing still counts', () => {
  const s = scoreStop(link('Plans and pricing'), 'find pricing page', reading).score
  assert.ok(s >= 0.6 && s < 1, `got ${s}`)
  assert.ok(scoreStop(link('Prices'), 'prices', reading).score === 1)
})

test('"add item to cart" matches an "Add to cart" button', () => {
  const button = { ...link('Add to cart'), tag: 'button' }
  assert.equal(scoreStop(button, 'add item to cart', reading).score, 0.8)
})

test('a screen reader goes by the announced name, not the words on screen', () => {
  const silent = link('Pricing', { accessibleName: '' })
  assert.equal(scoreStop(silent, 'find pricing page', reading).score, 1)
  const heard = scoreStop(silent, 'find pricing page', hearing)
  assert.equal(heard.score, 0)
  assert.equal(heard.scoreIfSeen, 0)
  assert.equal(heard.perceived, true)
})

test('a screen reader hears a label that is not on screen', () => {
  const icon = link('', { accessibleName: 'Pricing' })
  assert.equal(scoreStop(icon, 'find pricing page', reading).score, 0)
  assert.equal(scoreStop(icon, 'find pricing page', hearing).score, 1)
})

test('a field takes the name of the area it is in', () => {
  const inForm = field('Email', [{ kind: 'form', name: 'Checkout', heading: '' }])
  assert.equal(scoreStop(inForm, 'reach checkout form', reading).score, 0.8)
  assert.equal(scoreStop(inForm, 'reach checkout form', hearing).score, 0.8)
})

test('an area titled only by a heading is read by a person who sees it, not heard by name', () => {
  const inForm = field('Email', [{ kind: 'form', name: '', heading: 'Checkout' }])
  assert.equal(scoreStop(inForm, 'reach checkout form', reading).score, 0.8)
  assert.equal(scoreStop(inForm, 'reach checkout form', hearing).score, 0)
})

test('the heading of the whole page does not make every control match', () => {
  const inMain = link('Home', { landmarks: [{ kind: 'main', name: '', heading: 'Pricing' }] })
  assert.equal(scoreStop(inMain, 'find pricing page', reading).score, 0)
})

test('a kind named in the intent has to be met', () => {
  const checkoutLink = link('Checkout', { landmarks: [{ kind: 'nav', name: '', heading: '' }] })
  const half = scoreStop(checkoutLink, 'reach checkout form', reading)
  assert.equal(half.score, 0.5)
  assert.ok(half.score < 0.6)
  // Without the kind in the intent, the same link is a match.
  assert.equal(scoreStop(checkoutLink, 'go to checkout', reading).score, 1)
})

test('an intent that is only a kind matches any place of that kind', () => {
  const inForm = field('Email', [{ kind: 'form', name: '', heading: '' }])
  assert.equal(scoreStop(inForm, 'reach the form', reading).score, 1)
  assert.equal(scoreStop(link('Home'), 'reach the form', reading).score, 0)
})

test('frames and the body are never a match', () => {
  assert.equal(scoreStop({ kind: 'frame', rect: rectAt(0, 0) }, 'pricing', reading).score, 0)
  assert.equal(scoreStop({ kind: 'body' }, 'pricing', reading).score, 0)
})

test('tunnel vision: the middle of the screen is seen', () => {
  const v = scoreStop(link('Pricing', { rect: rectAt(590, 345) }), 'find pricing page', narrow())
  assert.equal(v.perceived, true)
  assert.equal(v.score, 1)
})

test('tunnel vision: a place far from the middle and from the last place is not seen', () => {
  const corner = link('Pricing', { rect: rectAt(1150, 660) })
  const v = scoreStop(corner, 'find pricing page', narrow({ x: 40, y: 20 }))
  assert.equal(v.perceived, false)
  assert.equal(v.score, 0)
  assert.equal(v.scoreIfSeen, 1)
})

test('tunnel vision: a place near the last place is seen even at the edge', () => {
  const corner = link('Pricing', { rect: rectAt(1150, 660) })
  const v = scoreStop(corner, 'find pricing page', narrow({ x: 1100, y: 640 }))
  assert.equal(v.perceived, true)
  assert.equal(v.score, 1)
})

test('tunnel vision: a place with no position is not seen', () => {
  const v = scoreStop(link('Pricing', { rect: null }), 'find pricing page', narrow())
  assert.equal(v.perceived, false)
})

test('a screen reader does not see, so the radius does not apply to it', () => {
  const corner = link('Pricing', { rect: rectAt(1150, 660) })
  const v = scoreStop(corner, 'find pricing page', { profileIds: ['screen-reader', 'tunnel-vision'], viewport })
  assert.equal(v.perceived, true)
  assert.equal(v.score, 1)
})

test('the profile a failure is filed under', () => {
  assert.equal(primaryProfile(['tunnel-vision', 'keyboard-only']), 'tunnel-vision')
  assert.equal(primaryProfile(['keyboard-only', 'screen-reader']), 'screen-reader')
  assert.equal(primaryProfile(['keyboard-only']), 'keyboard-only')
  assert.equal(primaryProfile([]), 'keyboard-only')
  assert.equal(perceptionFor(['screen-reader']), 'hearing')
  assert.equal(perceptionFor(['tunnel-vision']), 'narrow')
  assert.equal(perceptionFor(['keyboard-only']), 'reading')
})
