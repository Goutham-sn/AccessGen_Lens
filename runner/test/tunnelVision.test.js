// The tunnel-vision overlay of the recorded pass (needs Chromium and the
// built dist/profiles.js):
//   docker compose run --rm runner node --test test/tunnelVision.test.js
import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { chromium } from 'playwright'
import { applyProfiles, setConditionAnchor, installOverlay, overlayCall, settle } from '../src/pageScripts.js'
import { FILTER_PROFILE_IDS, OVERLAY_PROFILE_IDS } from '../src/inject/profilesEntry.js'
import { WALK_PROFILES } from '../src/walkProfiles.js'
import { stick } from '../src/measuringStick.js'
import { TASK_PROFILES } from '../../backend/src/config/runnerCapabilities.js'
import { readProfilesSource } from './helpers.js'

let browser
let profilesSource
before(async () => {
  browser = await chromium.launch({ chromiumSandbox: true })
  profilesSource = await readProfilesSource()
})
after(async () => { await browser?.close() })

const R = stick('task', 'tunnelRadiusPx')

async function open() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  const page = await context.newPage()
  await page.setContent('<!doctype html><body style="margin:0;background:#fff;height:3000px"><p>Tall page</p></body>')
  await page.evaluate(profilesSource)
  return { context, page }
}

// How dark the overlay is at a point of the screen, 0 (clear) to 255.
async function darkness(page, points) {
  await page.evaluate(settle)
  return page.evaluate((pts) => {
    const c = document.querySelector('canvas[data-accessgen="true"]')
    const ctx = c.getContext('2d')
    return pts.map(([x, y]) => ctx.getImageData(x, y, 1, 1).data[3])
  }, points)
}

test('tunnel vision applies when it is the only profile in the session', async () => {
  const { context, page } = await open()
  try {
    assert.equal(await page.evaluate(applyProfiles, [{ id: 'tunnel-vision', severity: 2 }]), 1)
    assert.equal(await page.locator('canvas[data-accessgen="true"]').count(), 1)
  } finally {
    await context.close()
  }
})

test('the page is clear within the radius of the screen middle and dark beyond it', async () => {
  const { context, page } = await open()
  try {
    await page.evaluate(applyProfiles, [{ id: 'tunnel-vision', severity: 2 }])
    const cx = 640
    const cy = 360
    const [middle, nearEdge, justOutside, corner, farSide] = await darkness(page, [
      [cx, cy], [cx + Math.round(R * 0.85), cy], [cx + Math.round(R * 1.15), cy], [1270, 710], [10, 360]
    ])
    assert.ok(middle < 10, `middle ${middle}`)
    assert.ok(nearEdge < 30, `just inside the radius ${nearEdge}`)
    assert.ok(justOutside > 200, `just outside the radius ${justOutside}`)
    assert.ok(corner > 230, `corner ${corner}`)
    assert.ok(farSide > 230, `far side ${farSide}`)
  } finally {
    await context.close()
  }
})

test('severity does not change the radius, because the walk judges one distance', async () => {
  const seen = []
  for (const severity of [1, 3]) {
    const { context, page } = await open()
    try {
      await page.evaluate(applyProfiles, [{ id: 'tunnel-vision', severity }])
      seen.push(await darkness(page, [[640 + Math.round(R * 0.85), 360], [640 + Math.round(R * 1.15), 360]]))
    } finally {
      await context.close()
    }
  }
  assert.deepEqual(seen[0], seen[1])
})

test('the place the person was just at is clear too, and stays on the page when Tab scrolls', async () => {
  const { context, page } = await open()
  try {
    await page.evaluate(applyProfiles, [{ id: 'tunnel-vision', severity: 2 }])
    assert.ok((await darkness(page, [[100, 100]]))[0] > 230, 'dark before there is an anchor')

    await page.evaluate(setConditionAnchor, { x: 100, y: 100 })
    const [atAnchor, below] = await darkness(page, [[100, 100], [100, 300]])
    assert.ok(atAnchor < 10, 'clear at the anchor')
    assert.ok(below < 30, `clear 200 px from it (${below})`)

    // The page scrolls by 250: the anchor is now 150 px above the top of the
    // screen, so the place 200 px under it on screen has gone dark and the
    // top of the screen, 210 px from it, is clear.
    await page.evaluate(() => window.scrollTo(0, 250))
    const [wasClear, nowClear] = await darkness(page, [[100, 300], [100, 60]])
    assert.ok(wasClear > 230, `the old position went dark (${wasClear})`)
    assert.ok(nowClear < 30, `near the anchor's new place it is clear (${nowClear})`)

    await page.evaluate(setConditionAnchor, null)
    await page.evaluate(() => window.scrollTo(0, 0))
    assert.ok((await darkness(page, [[100, 100]]))[0] > 230, 'dark again once the anchor is cleared')
  } finally {
    await context.close()
  }
})

test('the dark is paused for evidence shots and comes back, like a filter', async () => {
  const { context, page } = await open()
  try {
    await page.evaluate(applyProfiles, [{ id: 'tunnel-vision', severity: 2 }])
    await page.evaluate(installOverlay)
    const shown = () => page.evaluate(() => document.querySelector('canvas[data-accessgen="true"]').style.display)
    const before = await shown()
    await page.evaluate(overlayCall, { method: 'pauseFilter' })
    assert.equal(await shown(), 'none')
    await page.evaluate(overlayCall, { method: 'resumeFilter' })
    assert.equal(await shown(), before)
  } finally {
    await context.close()
  }
})

test('taking it off leaves the page as it was', async () => {
  const { context, page } = await open()
  try {
    await page.evaluate(applyProfiles, [{ id: 'tunnel-vision', severity: 2 }])
    await page.evaluate(() => window[Symbol.for('accessgen.runner.profiles')].destroy())
    assert.equal(await page.locator('canvas[data-accessgen="true"]').count(), 0)
  } finally {
    await context.close()
  }
})

test('every profile a task run accepts has a way to be simulated, and filters stay filters', () => {
  for (const id of TASK_PROFILES) {
    assert.ok(WALK_PROFILES.has(id) || OVERLAY_PROFILE_IDS.includes(id), `${id} has no implementation in the runner`)
  }
  assert.ok(OVERLAY_PROFILE_IDS.includes('tunnel-vision'))
  assert.ok(!FILTER_PROFILE_IDS.includes('tunnel-vision'), 'a canvas is not a filter on <html>')
})
