// When Playback stops waiting for a recording:  npm test  (in web-app)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { uploadWindowEndsAt } from '../src/utils/uploadWindow.js'

const MIN = 60 * 1000

test('an extension session waits until 10 minutes after it ended, not after the page opened', () => {
  const end = Date.now() - 3 * MIN
  assert.equal(uploadWindowEndsAt({ source: 'extension', end_time: new Date(end).toISOString() }), end + 10 * MIN)
})

test('a session that ended more than 10 minutes ago is already final', () => {
  const ended = new Date(Date.now() - 11 * MIN).toISOString()
  assert.ok(Date.now() >= uploadWindowEndsAt({ source: 'extension', end_time: ended }))
})

test('a session still going keeps waiting', () => {
  assert.equal(uploadWindowEndsAt({ source: 'extension', end_time: null }), Infinity)
})

test('a finished runner session never waits, an unfinished one does', () => {
  assert.equal(uploadWindowEndsAt({ source: 'runner', processing_complete: true }), 0)
  assert.equal(uploadWindowEndsAt({ source: 'runner', processing_complete: false }), Infinity)
})
