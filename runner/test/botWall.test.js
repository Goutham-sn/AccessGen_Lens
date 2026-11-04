// The bot wall rule (src/botWall.js): stop only when the page itself is the
// check, never because a page embeds a CAPTCHA box or frame.
// Needs Chromium, so run it in the runner container:
//   docker compose run --rm runner node --test test/botWall.test.js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { serveFixtureDir, FIXTURE_HOST } from '../src/checks/fixtureServer.js'
import { loadPage } from '../src/load.js'
import { checkBotWall, botWallEvidenceLine } from '../src/botWall.js'

const here = path.dirname(fileURLToPath(import.meta.url))
let browser
before(async () => { browser = await chromium.launch({ chromiumSandbox: true }) })
after(async () => { await browser?.close() })

async function check(file) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  try {
    await serveFixtureDir(context, path.join(here, '../fixtures/bot-wall'))
    const page = await context.newPage()
    const loaded = await loadPage(page, `${FIXTURE_HOST}/${file}`, { deadline: Date.now() + 60000 })
    assert.equal(loaded.ok, true, loaded.reason)
    return await checkBotWall(page, loaded.status)
  } finally {
    await context.close()
  }
}

test('a form page with an embedded reCAPTCHA box runs, and the signs are kept', async () => {
  const { wall, evidence } = await check('form-recaptcha.html')
  assert.equal(wall, false)
  assert.deepEqual(evidence.rules, ['marker', 'frame'])
  assert.equal(evidence.marker, '.g-recaptcha')
  assert.equal(evidence.frameHost, 'other-site.lens.test')
  assert.equal(evidence.status, 200)
  assert.equal(evidence.title, 'Join the newsletter')
  assert.equal(evidence.fields, 2)
  assert.equal(evidence.almostNoContent, false)
  // Short as it is, its own form fields are what keep it going.
  assert.ok(evidence.textChars < 1000, `${evidence.textChars} characters`)
})

test('a page that is itself the check stops, with the rule and its evidence', async () => {
  const { wall, evidence } = await check('challenge.html')
  assert.equal(wall, true)
  assert.deepEqual(evidence.rules, ['marker', 'frame', 'title'])
  assert.equal(evidence.marker, '#challenge-form')
  assert.equal(evidence.frameHost, 'other-site.lens.test')
  assert.equal(evidence.status, 200)
  assert.equal(evidence.title, 'Just a moment...')
  assert.equal(evidence.fields, 0)
  assert.equal(evidence.controls, 1)
  assert.equal(evidence.almostNoContent, true)
  assert.equal(botWallEvidenceLine(evidence),
    'Rule: marker, frame and title signs, with almost no content of its own. Marker: #challenge-form. ' +
    'Frame host: other-site.lens.test. Status: 200. Title: “Just a moment...”. ' +
    `Own content: ${evidence.textChars} characters of text, 0 form fields, 1 link or button.`)
})

test('a page with no sign has no evidence', async () => {
  const { wall, evidence } = await check('captcha-box.html')
  assert.equal(wall, false)
  assert.equal(evidence, null)
})
