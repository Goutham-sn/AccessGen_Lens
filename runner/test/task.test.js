// Needs Chromium, so run it in the runner container:
//   docker compose run --rm runner node --test test/task.test.js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { taskWalk } from '../src/task.js'
import { openFixture } from './helpers.js'

let browser
before(async () => { browser = await chromium.launch({ chromiumSandbox: true }) })
after(async () => { await browser?.close() })

const KEYBOARD = ['keyboard-only']
const SCREEN_READER = ['keyboard-only', 'screen-reader']
const TUNNEL = ['keyboard-only', 'tunnel-vision']

// Opens a fixture, walks the intents, and hands back the result and the page
// (still open, for checking what the walk left behind).
async function run(file, intents, { profileIds = KEYBOARD, budget, deadline = Date.now() + 30000, ...rest } = {}) {
  const { context, page } = await openFixture(browser, 'task', file)
  try {
    const result = await taskWalk(page, { intents, profileIds, deadline, budget, ...rest })
    return { result, url: page.url(), page, context }
  } catch (err) {
    await context.close()
    throw err
  }
}

async function walk(file, intents, opts) {
  const out = await run(file, intents, opts)
  try {
    return { ...out.result, url: out.url, submitted: await out.page.evaluate(() => window.submitted ?? false) }
  } finally {
    await out.context.close()
  }
}

test('a link in the menu is reached, and Enter is not pressed on the last intent', async () => {
  const r = await walk('home.html', ['find pricing page'])
  assert.equal(r.ended, 'done')
  assert.equal(r.failure, null)
  assert.equal(r.outcomes[0].status, 'reached')
  assert.equal(r.outcomes[0].stop.name, 'Pricing')
  assert.equal(r.outcomes[0].stopsAttempted, 3)
  assert.equal(r.enters, 0)
  assert.ok(r.url.endsWith('/home.html'), 'the page was not left')
})

test('a list of intents is followed across pages, ending inside the form', async () => {
  const r = await walk('home.html', ['find pricing page', 'add item to cart', 'go to checkout', 'reach checkout form'])
  assert.equal(r.ended, 'done')
  assert.deepEqual(r.outcomes.map((o) => o.status), ['reached', 'reached', 'reached', 'reached'])
  assert.deepEqual(r.outcomes.map((o) => o.stop.name), ['Pricing', 'Add to cart', 'Checkout', 'Email'])
  assert.equal(r.outcomes[3].stop.tag, 'input')
  assert.equal(r.enters, 3, 'Enter on the first three only')
  assert.ok(r.url.endsWith('/checkout.html'))
  assert.deepEqual([...new Set(r.stops.map((s) => s.page))], [0, 1, 2], 'one count per document')
})

test('nothing is typed and no form is submitted on the way', async () => {
  const { result, page, context } = await run('home.html', ['find pricing page', 'add item to cart', 'go to checkout', 'reach checkout form'])
  try {
    assert.equal(result.ended, 'done')
    assert.equal(await page.inputValue('#email'), '')
    assert.equal(await page.inputValue('#card'), '')
  } finally {
    await context.close()
  }
})

test('a target far down the list is reached after more stops', async () => {
  const r = await walk('deep.html', ['find pricing page'])
  assert.equal(r.ended, 'done')
  assert.equal(r.outcomes[0].stopsAttempted, 15)
  assert.equal(r.outcomes[0].stop.name, 'Pricing')
})

test('running out of stops is a failure, and later intents stay in the list unattempted', async () => {
  const r = await walk('deep.html', ['find pricing page', 'reach checkout form'], { budget: { stopsPerIntent: 5 } })
  assert.equal(r.ended, 'failed')
  assert.equal(r.failure.reason, 'budget-stops')
  assert.equal(r.failure.intent, 'find pricing page')
  assert.equal(r.failure.intentIndex, 0)
  assert.equal(r.failure.stopsAttempted, 5)
  assert.equal(r.failure.lastStop.name, 'Section 5')
  assert.equal(r.failure.profile, 'keyboard-only')
  assert.ok(r.failure.elapsedMs >= 0)
  assert.equal(r.outcomes.length, 2)
  assert.equal(r.outcomes[0].status, 'failed')
  assert.equal(r.outcomes[1].status, 'not-attempted')
  assert.equal(r.outcomes[1].reason, 'earlier-intent-failed')
})

test('something that is not on the page ends at the wrap', async () => {
  const r = await walk('home.html', ['find careers page'])
  assert.equal(r.ended, 'failed')
  assert.equal(r.failure.reason, 'wrapped')
  assert.equal(r.failure.stopsAttempted, 4)
  assert.equal(r.failure.lastStop.name, 'Contact')
})

test('a deadline that has passed is a failure with no stops', async () => {
  const r = await walk('home.html', ['find pricing page'], { deadline: Date.now() - 1 })
  assert.equal(r.failure.reason, 'budget-time')
  assert.equal(r.failure.stopsAttempted, 0)
  assert.equal(r.failure.lastStop, null)
})

test('an intent behind the persona is found by going round the page', async () => {
  const r = await walk('behind.html', ['find gamma', 'find alpha'])
  assert.equal(r.ended, 'done')
  assert.deepEqual(r.outcomes.map((o) => o.stop.name), ['Gamma', 'Alpha'])
  // Gamma to the end, the page itself, then Alpha.
  assert.equal(r.outcomes[1].stopsAttempted, 1)
})

test('a screen reader does not find a link that is only on screen', async () => {
  const sighted = await walk('unnamed.html', ['find pricing page'], { profileIds: KEYBOARD })
  assert.equal(sighted.ended, 'done')
  assert.equal(sighted.stops[1].accessibleName, '')
  assert.equal(sighted.stops[1].visibleText, 'Pricing')

  const heard = await walk('unnamed.html', ['find pricing page'], { profileIds: SCREEN_READER })
  assert.equal(heard.ended, 'failed')
  assert.equal(heard.failure.reason, 'wrapped')
  assert.equal(heard.failure.profile, 'screen-reader')
  assert.equal(heard.failure.stopsAttempted, 3)
})

test('tunnel vision misses a link in the far corner that others find', async () => {
  const sighted = await walk('peripheral.html', ['find pricing page'], { profileIds: KEYBOARD })
  assert.equal(sighted.ended, 'done')
  assert.equal(sighted.outcomes[0].stop.name, 'Pricing')

  const narrow = await walk('peripheral.html', ['find pricing page'], { profileIds: TUNNEL })
  assert.equal(narrow.ended, 'failed')
  assert.equal(narrow.failure.reason, 'wrapped')
  assert.equal(narrow.failure.profile, 'tunnel-vision')
  const pricing = narrow.stops.find((s) => s.name === 'Pricing')
  assert.equal(pricing.perceived, false)
  assert.equal(pricing.score, 0)
  assert.equal(narrow.outcomes[0].missed.stop.name, 'Pricing')
})

test('tunnel vision misses a link far down a long page: Tab scrolls it in at the bottom edge', async () => {
  const sighted = await walk('below-fold.html', ['find pricing page'], { profileIds: KEYBOARD })
  assert.equal(sighted.ended, 'done')

  const narrow = await walk('below-fold.html', ['find pricing page'], { profileIds: TUNNEL })
  assert.equal(narrow.ended, 'failed')
  const pricing = narrow.stops.find((s) => s.name === 'Pricing')
  assert.ok(pricing.rect.y > 600, `scrolled in at the edge, not the middle (y ${pricing.rect.y})`)
  assert.equal(pricing.perceived, false)
  assert.equal(narrow.outcomes[0].missed.stop.name, 'Pricing')
})

test('a stop is named for what the persona makes of it', async () => {
  const sighted = await walk('unnamed.html', ['find pricing page'], { profileIds: KEYBOARD })
  assert.equal(sighted.stops[1].name, 'Pricing')
  const heard = await walk('unnamed.html', ['find pricing page'], { profileIds: SCREEN_READER })
  assert.equal(heard.stops[1].name, '')
  assert.deepEqual(heard.stops.map((s) => s.name), ['Home', '', 'About'])
})

test('a link to another site is found but not followed', async () => {
  const r = await walk('leaves.html', ['find pricing page', 'reach checkout form'])
  assert.equal(r.ended, 'stopped')
  assert.equal(r.stoppedBecause, 'leaves-site')
  assert.equal(r.failure, null, 'the runner’s limit is not the persona’s failure')
  assert.equal(r.outcomes[0].status, 'reached')
  assert.equal(r.outcomes[1].status, 'not-attempted')
  assert.equal(r.outcomes[1].reason, 'leaves-site')
  assert.equal(r.enters, 0)
  assert.ok(r.url.endsWith('/leaves.html'))
})

test('a button that submits a form is found but not pressed', async () => {
  const r = await walk('submit.html', ['add item to cart', 'reach checkout form'])
  assert.equal(r.ended, 'stopped')
  assert.equal(r.stoppedBecause, 'submits-form')
  assert.equal(r.outcomes[0].status, 'reached')
  assert.equal(r.enters, 0)
  assert.equal(r.submitted, false)
})

test('the walk tells its caller before each Tab, and when a new page has loaded', async () => {
  const before = []
  let documents = 0
  const r = await walk('home.html', ['find pricing page', 'add item to cart', 'go to checkout', 'reach checkout form'], {
    onBeforePress: (previous) => { before.push(previous) },
    onDocument: () => { documents++ }
  })
  assert.equal(r.ended, 'done')
  assert.equal(documents, 2, 'home to pricing, pricing to checkout')
  assert.equal(before.filter((p) => p === null).length, 3, 'the first Tab of each of the three pages has nowhere it came from')
  assert.equal(before[0], null)
  for (const p of before.filter((x) => x !== null)) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y))
})

test('a place that could not be made out remembers where the person came from', async () => {
  const r = await walk('peripheral.html', ['find pricing page'], { profileIds: TUNNEL })
  const missed = r.outcomes[0].missed
  assert.equal(missed.stop.name, 'Pricing')
  assert.ok(missed.from.x < 100 && missed.from.y < 100, `the Home link, top left: ${JSON.stringify(missed.from)}`)
})

test('onStop and onIntent report each stop and each finished intent', async () => {
  const seen = []
  const done = []
  const r = await walk('home.html', ['find pricing page', 'add item to cart'], {
    onStop: (stop, n, intentIndex) => { seen.push([n, intentIndex, stop.name]) },
    onIntent: (outcome, index) => { done.push([index, outcome.status]) }
  })
  assert.deepEqual(seen.slice(0, 3), [[1, 0, 'Home'], [2, 0, 'About'], [3, 0, 'Pricing']])
  assert.equal(seen.length, r.stops.length)
  assert.deepEqual(done.map((d) => d[0]), [0, 1])
})
