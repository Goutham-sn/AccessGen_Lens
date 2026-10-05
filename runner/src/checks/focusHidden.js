import { focusHiddenCopy } from '../copy.js'
import { probeStop, personaName, readFocusedNow } from './keyboard/probe.js'
import { runKeyboardFixture } from './keyboard/fixture.js'

// Check 'focus-hidden': the element Tab reached is covered. Measured after
// focus and scrolling settle, at its centre and four inner corners. All 5
// points must find the same element on top, one that is not part of the
// focused element and not one of its parents, and that paints: opacity
// above 0 through its parents, visibility visible, and a background that is
// not transparent or content of its own.
export default {
  id: 'focus-hidden',
  async onStop(ctx) {
    const p = await probeStop(ctx)
    if (p.skip || p.closedShadow || p.hidden || !p.cover) return []
    return [{
      detector: 'focus-hidden',
      profile: 'keyboard-only',
      selector: ctx.stop.selector,
      ...focusHiddenCopy({ persona: personaName(ctx), step: ctx.step, name: p.name, role: p.role, cover: p.cover }),
      evidence: { coverTag: p.cover.tag, coverBox: p.cover.box, rect: p.rect }
    }]
  },
  async confirm({ page, finding }) {
    const now = await readFocusedNow(page)
    return Boolean(now?.cover && now.cover.tag === finding.evidence.coverTag)
  },
  runFixture: (browser, opts) => runKeyboardFixture(browser, opts, 'focus-hidden')
}
