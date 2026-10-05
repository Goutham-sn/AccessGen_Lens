// Evidence engine and overlay. Needs Chromium:
//   docker compose run --rm runner node --test test/evidence.test.js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { openFixture, readProfilesSource, pixelsOf, isMagenta } from './helpers.js'
import { createEvidenceEngine, makeFinding, groupFindings, formatVideoTime } from '../src/evidence.js'
import { installOverlay, overlayCall, applyProfiles, settle, locateAndDescribe } from '../src/pageScripts.js'
import { FILTER_PROFILE_IDS } from '../src/inject/profilesEntry.js'

let browser
let profilesSource
before(async () => {
  browser = await chromium.launch({ chromiumSandbox: true })
  profilesSource = await readProfilesSource()
})
after(async () => { await browser?.close() })

const finding = (selector, extra = {}) => makeFinding({
  detector: 'test', profile: 'keyboard-only', selector,
  headline: 'David would lose his place here.', fact: 'Measured fact.', forTeam: 'What would change it.', ...extra
})

async function layoutState(page) {
  return page.evaluate(() => ({
    rects: [...document.querySelectorAll('button, a, input, #big, h1')].map((el) => {
      const r = el.getBoundingClientRect()
      return [el.id || el.tagName, Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]
    }),
    active: document.activeElement?.id || null,
    hit: (() => { const r = document.getElementById('b2').getBoundingClientRect(); return document.elementFromPoint(r.x + 5, r.y + 5)?.id || null })(),
    scroll: [window.scrollX, window.scrollY]
  }))
}

test('a filter on <html> does not move fixed, sticky or absolute elements', async () => {
  for (const profile of FILTER_PROFILE_IDS) {
    const { context, page } = await openFixture(browser, 'evidence', 'fixed-under-filter.html')
    try {
      const read = () => page.evaluate(() => Object.fromEntries(['sticky', 'fixed', 'absolute'].map((id) => {
        const r = document.getElementById(id).getBoundingClientRect()
        return [id, [r.x, r.y, r.width, r.height]]
      })))
      for (const scrollY of [0, 1200]) {
        await page.evaluate((y) => window.scrollTo(0, y), scrollY)
        await page.evaluate(settle)
        const without = await read()
        await page.evaluate(profilesSource)
        await page.evaluate(applyProfiles, [{ id: profile, severity: 3 }])
        await page.evaluate(settle)
        const withFilter = await read()
        assert.ok(await page.evaluate(() => document.documentElement.style.filter !== ''), `${profile} applied a filter`)
        assert.deepEqual(withFilter, without, `${profile} at scroll ${scrollY}`)
        await page.evaluate(() => window[Symbol.for('accessgen.runner.profiles')].destroy())
      }
    } finally {
      await context.close()
    }
  }
})

test('the overlay never changes layout, focus or what is under the pointer', async () => {
  const { context, page } = await openFixture(browser, 'evidence', 'evidence.html')
  try {
    await page.focus('#b2')
    const before = await layoutState(page)
    await page.evaluate(installOverlay)
    await page.evaluate(overlayCall, { method: 'keyChip', args: ['Tab', 3] })
    const rect = await page.evaluate(() => document.getElementById('b2').getBoundingClientRect().toJSON())
    await page.evaluate(overlayCall, { method: 'highlight', args: [{ rect, number: 1, large: false }] })
    await page.evaluate(overlayCall, { method: 'caption', args: ['David would lose his place here.', '0:03'] })
    await page.evaluate(settle)
    assert.deepEqual(await layoutState(page), before)
    const a11yHasOverlay = (await page.locator('body').ariaSnapshot()).includes('lose his place')
    assert.equal(a11yHasOverlay, false, 'the caption is not in the accessibility tree')
  } finally {
    await context.close()
  }
})

test('capture takes a clean shot, a highlighted shot and a close-up, then cleans up', async () => {
  const { context, page } = await openFixture(browser, 'evidence', 'evidence.html')
  try {
    await page.evaluate(profilesSource)
    await page.evaluate(applyProfiles, [{ id: 'deuteranopia', severity: 3 }])
    await page.evaluate(installOverlay)
    await page.evaluate(overlayCall, { method: 'keyChip', args: ['Tab', 2] })
    const filterBefore = await page.evaluate(() => document.documentElement.style.filter)
    const engine = createEvidenceEngine({ page, readyAt: Date.now() - 5000 })
    const m = await engine.capture(finding('#b5'))
    assert.ok(m, 'captured')
    assert.equal(m.number, 1)
    assert.ok(m.videoMs >= 5000 && m.videoMs < 8000, `videoMs ${m.videoMs}`)

    // Ring pixel: magenta in the highlighted shot, not in the clean shot.
    const ringX = Math.round(m.overlay.ring.x + 1)
    const ringY = Math.round(m.overlay.ring.y + m.overlay.ring.height / 2)
    const shot = await pixelsOf(page, m.shots.shot, [[ringX, ringY]], 'image/jpeg')
    const clean = await pixelsOf(page, m.shots.clean, [[ringX, ringY]], 'image/jpeg')
    assert.equal(shot.width, 1280)
    assert.ok(isMagenta(shot.pixels[0]), `ring is magenta in the shot: ${shot.pixels[0]}`)
    assert.ok(!isMagenta(clean.pixels[0]), 'no ring in the clean shot')

    // Close-up: the element plus 40 px on each side (inside the viewport).
    const close = await pixelsOf(page, m.shots.closeup, [[0, 0]], 'image/jpeg')
    assert.equal(close.width, m.element.rect.width + 80)
    assert.equal(close.height, m.element.rect.height + 80)

    // Cleaned up: filter back, chip back, ring gone.
    assert.equal(await page.evaluate(() => document.documentElement.style.filter), filterBefore)
    const after = await page.screenshot()
    const afterPx = await pixelsOf(page, after, [[ringX, ringY]])
    assert.ok(!isMagenta(afterPx.pixels[0]), 'ring removed')
  } finally {
    await context.close()
  }
})

test('the numbered label stays inside the viewport, and large elements get an inset dashed ring', async () => {
  const { context, page } = await openFixture(browser, 'evidence', 'evidence.html')
  try {
    await page.evaluate(installOverlay)
    const engine = createEvidenceEngine({ page, readyAt: Date.now() })
    const inside = (b) => b.x >= 0 && b.y >= 0 && b.x + b.width <= 1280 && b.y + b.height <= 720
    const top = await engine.capture(finding('#corner'))
    assert.ok(inside(top.overlay.label), `label inside at the top left: ${JSON.stringify(top.overlay.label)}`)
    const end = await engine.capture(finding('#far-corner'))
    assert.ok(inside(end.overlay.label), `label inside at the bottom right: ${JSON.stringify(end.overlay.label)}`)
    const big = await engine.capture(finding('#big'))
    assert.equal(big.large, true)
    assert.ok(inside(big.overlay.ring), `dashed ring inside the viewport: ${JSON.stringify(big.overlay.ring)}`)
  } finally {
    await context.close()
  }
})

test('only the first eight moments are held on screen', async () => {
  const { context, page } = await openFixture(browser, 'evidence', 'evidence.html')
  try {
    await page.evaluate(installOverlay)
    const engine = createEvidenceEngine({ page, readyAt: Date.now() })
    const results = []
    for (let i = 1; i <= 9; i++) {
      const t = Date.now()
      const m = await engine.capture(finding(`#b${i}`))
      results.push({ held: m.held, ms: Date.now() - t })
    }
    assert.deepEqual(results.map((r) => r.held), [true, true, true, true, true, true, true, true, false])
    assert.ok(results[0].ms >= 1200, `held moment took ${results[0].ms} ms`)
    assert.ok(results[8].ms < 1000, `ninth moment took ${results[8].ms} ms`)
  } finally {
    await context.close()
  }
})

test('describing an element strips form values and scripts and stays short', async () => {
  const { context, page } = await openFixture(browser, 'evidence', 'evidence.html')
  try {
    const input = await page.evaluate(locateAndDescribe, '#secret')
    assert.ok(!input.html.includes('4111'), 'form value removed')
    const scripted = await page.evaluate(locateAndDescribe, '#scripted')
    assert.ok(!scripted.html.includes('__fixture'), 'script content removed')
    const big = await page.evaluate(locateAndDescribe, 'main')
    assert.ok(big.html.length <= 200)
    assert.equal(await page.evaluate(locateAndDescribe, '#does-not-exist'), null)
  } finally {
    await context.close()
  }
})

test('repeated findings become one moment with a count and three examples', () => {
  const many = Array.from({ length: 40 }, (_, i) => finding(`#icon-${i}`, { detector: 'unnamed-controls', patternKey: 'button-no-name', step: 40 - i }))
  const other = finding('#title', { detector: 'structure' })
  const groups = groupFindings([...many, other])
  assert.equal(groups.length, 2)
  const g = groups.find((x) => x.detector === 'unnamed-controls')
  assert.equal(g.pattern.count, 40)
  assert.equal(g.pattern.examples.length, 3)
  assert.equal(g.step, 1, 'the earliest one leads the group')
  assert.equal(groups.find((x) => x.detector === 'structure').pattern.count, 1)
})

test('findings must carry the full shape', () => {
  assert.throws(() => makeFinding({ detector: 'x', profile: 'keyboard-only', selector: '#a' }), /headline, fact, forTeam/)
  const f = finding('#a')
  assert.equal(f.tier, 'observed')
  assert.equal(formatVideoTime(65400), '1:05')
})
