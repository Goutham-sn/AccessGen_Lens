// When Playback stops waiting for a recording:  npm test  (in web-app)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { keepWaitingForVideo } from '../src/utils/uploadWindow.js'

const session = (extra = {}) => ({ video_url: null, ...extra })

test('no video and the server says the window is open: keep waiting', () => {
  assert.equal(keepWaitingForVideo({ session: session(), uploadWindow: { open: true, waitUntil: '2026-10-05T10:10:00Z' } }), true)
})

test('no video and the window has closed: final at once, no spinner', () => {
  assert.equal(keepWaitingForVideo({ session: session(), uploadWindow: { open: false, waitUntil: '2026-10-05T10:10:00Z' } }), false)
})

test('a video is there: stop waiting, whatever the window says', () => {
  assert.equal(keepWaitingForVideo({ session: session({ video_url: 'sessions/x/session.webm' }), uploadWindow: { open: true } }), false)
})

test('a response without the window (an older backend) never spins forever', () => {
  assert.equal(keepWaitingForVideo({ session: session() }), false)
})

test('nothing loaded yet keeps the loading state', () => {
  assert.equal(keepWaitingForVideo(null), true)
})
