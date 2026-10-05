// Needs Chromium, so run it in the runner container:
//   docker compose run --rm runner node --test test/walk.test.js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { tabWalk } from '../src/walk.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const FIXTURES = path.join(here, '../fixtures/walk')
const HOST = 'https://fixtures.lens.test'

let browser
before(async () => { browser = await chromium.launch({ chromiumSandbox: true }) })
after(async () => { await browser?.close() })

// Fixtures are served by route.fulfill, so nothing touches the network.
async function walkFixture(name) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  await context.route(`${HOST}/**`, async (route) => {
    const file = path.join(FIXTURES, path.basename(new URL(route.request().url()).pathname))
    const body = await fs.readFile(file, 'utf8').catch(() => null)
    return body == null
      ? route.fulfill({ status: 404, body: 'not found' })
      : route.fulfill({ status: 200, contentType: 'text/html', body })
  })
  const page = await context.newPage()
  await page.goto(`${HOST}/${name}`)
  try {
    return await tabWalk(page, { deadline: Date.now() + 20000 })
  } finally {
    await context.close()
  }
}

test('three focusable elements give three stops, then wrap', async () => {
  const walk = await walkFixture('three.html')
  assert.equal(walk.ended, 'wrapped')
  assert.deepEqual(walk.stops.map((s) => s.name), ['One', 'Two', 'Three'])
  assert.ok(walk.stops.every((s) => s.kind !== 'body'), 'the body is never counted as a stop')
})

test('hidden and script-only elements are not stops', async () => {
  const walk = await walkFixture('hidden.html')
  assert.equal(walk.ended, 'wrapped')
  assert.equal(walk.stops.length, 3)
  assert.deepEqual(walk.stops.map((s) => s.tag), ['a', 'button', 'input'])
})

test('a skip link is the first stop', async () => {
  const walk = await walkFixture('skiplink.html')
  assert.equal(walk.ended, 'wrapped')
  assert.equal(walk.stops.length, 4)
  assert.equal(walk.stops[0].name, 'Skip to content')
  assert.deepEqual(walk.stops.slice(1).map((s) => s.name), ['Home', 'About', 'Start'])
})
