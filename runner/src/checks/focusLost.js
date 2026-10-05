import { stick } from '../measuringStick.js'
import { focusLostToPageCopy, focusLostHiddenCopy } from '../copy.js'
import { probeStop, pageState, personaName, readFocusedNow } from './keyboard/probe.js'
import { runKeyboardFixture } from './keyboard/fixture.js'

// Check 'focus-lost', two kinds:
//   a. Tab moved focus to the page itself mid-way (the walk keeps such a
//      body visit as a stop; a wrap at the end is not one). Presses in a
//      row that all end there are one moment.
//   b. Tab landed on an element that cannot be seen: zero size, fully
//      transparent through its parents, or outside the screen. Reported
//      only if its label (when it has one) and its nearest parent also look
//      exactly the same with focus as without, measured after focus settles.

const who = (p) => {
  if (!p) return null
  if (p.skip === 'frame') return { name: '', role: 'frame' }
  if (p.skip) return { name: p.stop.name, role: p.stop.tag }
  return { name: p.name, role: p.role }
}

export default {
  id: 'focus-lost',
  async onStop(ctx) {
    const p = await probeStop(ctx)
    if (p.skip || p.closedShadow || !p.hidden) return []
    const d = await p.diff(['label', 'parent'])
    if (!d.restored || d.changed.label || d.changed.parent) return []
    return [{
      detector: 'focus-lost',
      profile: 'keyboard-only',
      selector: ctx.stop.selector,
      ...focusLostHiddenCopy({
        persona: personaName(ctx), step: ctx.step, name: p.name, role: p.role,
        hidden: p.hidden, label: p.label ? p.label.text : null
      }),
      evidence: { kind: 'hidden', hidden: p.hidden, rect: p.rect }
    }]
  },
  // One moment per run of presses that end on the page itself. The element
  // that had focus for a moment during those presses (recorded by the
  // measure pass's focusin record) is named and highlighted; with none
  // recorded, no cause is given and the page itself is highlighted.
  async measure(ctx) {
    const s = pageState(ctx.page)
    const stops = ctx.stops || []
    const findings = []
    for (let i = 0; i < stops.length; i++) {
      if (stops[i].kind !== 'body') continue
      let j = i
      while (j + 1 < stops.length && stops[j + 1].kind === 'body') j++
      const presses = j - i + 1
      const prev = who(await s.probes.get(i))
      const next = who(await s.probes.get(j + 2))
      const flashed = stops.slice(i, j + 1).map((stop) => stop.flashed).filter(Boolean)
      if (prev) {
        findings.push({
          detector: 'focus-lost',
          profile: 'keyboard-only',
          selector: flashed[0]?.selector ?? 'body',
          // The recorded walk is on the page itself at this stop.
          stopSelector: 'body',
          step: i + 1,
          ...focusLostToPageCopy({
            persona: personaName(ctx), prevStep: i, presses, prev, next,
            flashed, maxNames: stick('keyboard', 'maxStopNames')
          }),
          evidence: { kind: 'to-page', presses, flashed: flashed.map((f) => f.selector) }
        })
      }
      i = j
    }
    return findings
  },
  async confirm({ page, finding }) {
    if (finding.evidence.kind === 'to-page') return true
    const now = await readFocusedNow(page)
    return Boolean(now?.hidden && now.hidden.kind === finding.evidence.hidden.kind)
  },
  runFixture: (browser, opts) => runKeyboardFixture(browser, opts, 'focus-lost')
}
