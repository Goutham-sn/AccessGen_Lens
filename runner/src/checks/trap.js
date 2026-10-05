import { trapCopy } from '../copy.js'
import { settle, describeActive, detectModal } from '../pageScripts.js'
import { probeStop, pageState, personaName, countUnreached } from './keyboard/probe.js'
import { runKeyboardFixture } from './keyboard/fixture.js'

// Check 'trap': Tab goes round the same places and never reaches the rest.
//
// The walk ends with 'cycle' when the same k element stops (k of 2 or more)
// have come round in the same order trapRounds times without the page
// itself in between, which is how Chromium wraps on its own. Reported only
// when, as well:
//   - none of them is a frame or inside a closed shadow root
//   - no dialog is open, and none of them is inside one (a dialog that
//     keeps focus inside is doing its job)
//   - at least one other focusable element was never reached
//   - one press of Escape leaves focus inside the same places
// Enter and Space are never pressed, and the fact says so.
// Runs last: Escape is the final key of the measure pass.

async function escapeStaysInside(page, selectors) {
  await page.keyboard.press('Escape')
  await page.evaluate(settle)
  const now = await page.evaluate(describeActive)
  return now.kind === 'element' && selectors.has(now.selector)
}

export default {
  id: 'trap',
  async onStop(ctx) {
    await probeStop(ctx)
    return []
  },
  async measure(ctx) {
    const { page, walk } = ctx
    if (walk?.ended !== 'cycle') return []
    const { fromStep, k, rounds, presses } = walk.cycle
    const s = pageState(page)
    const places = await Promise.all(Array.from({ length: k }, (_, i) => s.probes.get(fromStep + i)))
    if (places.some((p) => !p || p.skip || p.closedShadow || p.inDialog)) return []
    if (await page.evaluate(detectModal)) return []
    const unreached = await page.evaluate(countUnreached)
    if (unreached === 0) return []
    const selectors = new Set(places.map((p) => p.stop.selector))
    if (!(await escapeStaysInside(page, selectors))) return []

    return [{
      detector: 'trap',
      profile: 'keyboard-only',
      selector: places[0].stop.selector,
      ...trapCopy({
        persona: personaName(ctx), fromStep, k, rounds, presses,
        places: places.map((p) => ({ name: p.name, role: p.role })), unreached
      }),
      evidence: { fromStep, k, rounds, presses, unreached, selectors: [...selectors] }
    }]
  },
  // Recorded pass, after its walk: the walk went round the same places, and
  // Escape still leaves focus inside them.
  async confirm({ page, finding, walk }) {
    if (walk?.ended !== 'cycle' || walk.cycle.k !== finding.evidence.k) return false
    const selectors = new Set(finding.evidence.selectors)
    const loop = walk.stops.slice(walk.cycle.fromStep - 1, walk.cycle.fromStep - 1 + walk.cycle.k)
    if (!loop.every((stop) => selectors.has(stop.selector))) return false
    return escapeStaysInside(page, selectors)
  },
  runFixture: (browser, opts) => runKeyboardFixture(browser, opts, 'trap')
}
