// The readiness rule (src/load.js) on pages that are slow, reload
// themselves, never show anything, or never stop changing.
// Needs Chromium, so run it in the runner container:
//   docker compose run --rm runner node --test test/load.test.js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { serveFixtureDir, FIXTURE_HOST } from '../src/checks/fixtureServer.js'
import { loadPage, STILL_EMPTY } from '../src/load.js'

const here = path.dirname(fileURLToPath(import.meta.url))
let browser
before(async () => { browser = await chromium.launch({ chromiumSandbox: true }) })
after(async () => { await browser?.close() })

async function load(file) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  await serveFixtureDir(context, path.join(here, '../fixtures/load'))
  const page = await context.newPage()
  const result = await loadPage(page, `${FIXTURE_HOST}/${file}`, { deadline: Date.now() + 60000 })
  const text = await page.evaluate(() => document.body?.innerText || '').catch(() => '')
  await context.close()
  return { result, text }
}

test('content that appears after 6 s: ready once it is there and has settled', async () => {
  const { result, text } = await load('late-content.html')
  assert.equal(result.ok, true)
  assert.equal(result.changing, false)
  assert.ok(result.readyMs >= 6000, `ready at ${result.readyMs} ms`)
  assert.ok(text.includes('Late content'))
})

test('a page that reloads itself once: ready on the second load, a second after it', async () => {
  const { result, text } = await load('self-navigate.html')
  assert.equal(result.ok, true)
  assert.equal(result.changing, false)
  assert.ok(text.includes('Second load'), text)
  assert.ok(result.readyMs >= 1800, `ready at ${result.readyMs} ms`)
})

test('a page still empty at 12 s stops with a plain reason', async () => {
  const { result } = await load('never-content.html')
  assert.equal(result.ok, false)
  assert.equal(result.empty, true)
  assert.equal(result.reason, STILL_EMPTY)
  assert.equal(STILL_EMPTY, 'The page was still empty after 12 seconds, so we could not look at it.')
})

test('a page still changing at 12 s goes ahead, marked as changing', async () => {
  const { result } = await load('always-changing.html')
  assert.equal(result.ok, true)
  assert.equal(result.changing, true)
  assert.ok(result.readyMs >= 11500, `ready at ${result.readyMs} ms`)
})
