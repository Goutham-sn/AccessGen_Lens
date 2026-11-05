import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pinOf } from '../src/utils/pins.js'

test('a rect in viewport pixels becomes a ring in percent of the picture', () => {
  const p = pinOf({ x: 100, y: 50, width: 40, height: 20, vw: 1000, vh: 500 })
  const r = Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Math.round(v * 10) / 10]))
  assert.deepEqual(r, { left: 9.4, top: 8.8, width: 5.2, height: 6.4 })
})

test('no viewport size, or a rect off the picture, gives no ring', () => {
  assert.equal(pinOf({ x: 1, y: 1, width: 5, height: 5 }), null)
  assert.equal(pinOf({ x: 2000, y: 10, width: 5, height: 5, vw: 1000, vh: 500 }), null)
  assert.equal(pinOf(null), null)
})
