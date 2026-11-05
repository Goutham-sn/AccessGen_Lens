import { test } from 'node:test'
import assert from 'node:assert/strict'
import { playableFrames, frameAt } from '../src/utils/frames.js'

const frames = [
  { frame_index: 0, timestamp_ms: 0, screenshot_url: 'thumb' },
  { frame_index: 30, timestamp_ms: 3000, screenshot_url: 'c' },
  { frame_index: 8, timestamp_ms: 800, screenshot_url: 'a' },
  { frame_index: 15, timestamp_ms: 1500, screenshot_url: 'b' }
]

test('the old-style thumbnail (index 0) is not a frame, and frames play in time order', () => {
  assert.deepEqual(playableFrames(frames).map((f) => f.screenshot_url), ['a', 'b', 'c'])
})

test('each moment of playback shows the frame that was on screen then', () => {
  const list = playableFrames(frames)
  assert.equal(frameAt(list, 0), 0)
  assert.equal(frameAt(list, 0.69), 0)
  assert.equal(frameAt(list, 0.7), 1)
  assert.equal(frameAt(list, 2.19), 1)
  assert.equal(frameAt(list, 2.2), 2)
  assert.equal(frameAt(list, 99), 2)
  assert.equal(frameAt([], 1), -1)
})
