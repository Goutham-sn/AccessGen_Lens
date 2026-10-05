import { stick } from '../measuringStick.js'
import { focusNotVisibleCopy } from '../copy.js'
import { probeStop, personaName, readFocusedNow, hashOf } from './keyboard/probe.js'
import { runKeyboardFixture } from './keyboard/fixture.js'

// Check 'focus-visible': Tab reached an element and nothing showed it.
// Reported only when BOTH measurements show no change between the element
// with focus and without it:
//   - pixels: the screen within nearbyPx of it is byte-for-byte the same
//   - computed styles: outline, shadow, border, background, underline and
//     transform on it, its ::before and ::after, and its 3 nearest parents
// Skipped for elements that cannot be seen at all (focus-lost reports
// those) and for elements covered by something else (focus-hidden).
export default {
  id: 'focus-visible',
  async onStop(ctx) {
    const p = await probeStop(ctx)
    if (p.skip || p.closedShadow || p.hidden || p.cover) return []
    const d = await p.diff(['element'])
    if (!d.restored || d.changed.element || d.stylesChanged) return []
    const nearbyPx = stick('keyboard', 'nearbyPx')
    return [{
      detector: 'focus-visible',
      profile: 'keyboard-only',
      selector: ctx.stop.selector,
      // Elements that look the same with and without focus are one pattern.
      patternKey: hashOf([p.tag, p.role, p.styles[0]]),
      ...focusNotVisibleCopy({
        persona: personaName(ctx), step: ctx.step, name: p.name, role: p.role,
        nearbyPx, parentsCompared: p.parentsCompared
      }),
      evidence: { nearbyPx, parentsCompared: p.parentsCompared, clip: p.clips.element, stylesHash: p.stylesHash }
    }]
  },
  // Recorded pass: the element at this stop has the same computed styles
  // with focus as it had in the measure pass.
  async confirm({ page, finding }) {
    const now = await readFocusedNow(page)
    return Boolean(now && now.stylesHash === finding.evidence.stylesHash)
  },
  runFixture: (browser, opts) => runKeyboardFixture(browser, opts, 'focus-visible')
}
