import path from 'node:path'
import { findTabSkipped, skippedCopy, findForcedOrder, forcedOrderCopy } from '../../../extension/issues/tabSkipped.js'
import { installClickRecorder } from '../../../extension/issues/clickRecorder.js'
import { serveFixtureDir, FIXTURE_HOST } from './fixtureServer.js'
import { personaName } from './keyboard/probe.js'

// Check 'tab-skipped': everything on the page that can be clicked but that
// Tab never reaches (a real button with tabindex="-1", a div with a click
// handler, a role="button" with no focus, a link with no address, a hand
// pointer on something that takes no focus, a label for a hidden checkbox).
// One finding per element, so each is its own moment. The detector itself is
// shared with the extension: extension/issues/tabSkipped.js. Click handlers
// are seen through installClickRecorder, added to every context before the
// page loads (browser.js).
//
// Also, as one moment: places pulled to the front of the Tab order with a
// positive tabindex, so Tab jumps around the page.
//
// Runs for every person, like the page audit: whoever is simulated, a page a
// keyboard cannot use is a problem worth showing.

const MAX = 60
const confirmCache = new WeakMap()

function findingOf(item, name) {
  const copy = skippedCopy(item, name)
  return {
    detector: 'tab-skipped',
    profile: 'keyboard-only',
    selector: item.selector,
    // One moment per element, never folded into a count.
    patternKey: `skipped:${item.selector}`,
    headline: copy.headline,
    fact: copy.fact,
    forTeam: copy.forTeam,
    evidence: { skipped: true, reason: item.reason, how: item.how, kind: item.kind, name: item.name, html: item.html, rect: item.rect }
  }
}

export default {
  id: 'tab-skipped',
  async measure(ctx) {
    const list = await ctx.page.evaluate(findTabSkipped, { max: MAX })
    const name = personaName(ctx)
    const findings = list.map((item) => findingOf(item, name))
    const forced = await ctx.page.evaluate(findForcedOrder)
    if (forced.length) {
      findings.push({
        detector: 'tab-skipped',
        profile: 'keyboard-only',
        selector: forced[0].selector,
        patternKey: 'forced-order',
        ...forcedOrderCopy(forced, name),
        evidence: { forcedOrder: true, count: forced.length, places: forced.slice(0, 20) }
      })
    }
    return findings
  },
  // Recorded pass: the element is still there and Tab still skips it.
  async confirm({ page, finding }) {
    if (finding.evidence?.forcedOrder) {
      const forced = await page.evaluate(findForcedOrder).catch(() => [])
      return forced.some((f) => f.selector === finding.selector)
    }
    if (!confirmCache.has(page)) confirmCache.set(page, page.evaluate(findTabSkipped, { max: MAX }).catch(() => []))
    const list = await confirmCache.get(page)
    return list.some((i) => i.selector === finding.selector)
  },
  async runFixture(browser, { fixtureDir, expected }) {
    const out = {}
    for (const file of Object.keys(expected)) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
      try {
        await context.addInitScript(installClickRecorder)
        await serveFixtureDir(context, path.resolve(fixtureDir))
        const page = await context.newPage()
        await page.goto(`${FIXTURE_HOST}/${file}`)
        const list = await page.evaluate(findTabSkipped, { max: MAX })
        const forced = await page.evaluate(findForcedOrder)
        out[file] = { skipped: list.map((i) => `${i.selector.replace(/^#/, '')}:${i.reason}:${i.how}`), forcedOrder: forced.map((f) => f.selector.replace(/^#/, '')) }
      } finally {
        await context.close()
      }
    }
    return out
  }
}
