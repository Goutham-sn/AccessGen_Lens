import { stick } from '../measuringStick.js'
import { longWayCopy, coverageLines } from '../copy.js'
import { probeStop, pageState, personaName, visibleCookieNotice, COOKIE_MARKERS } from './keyboard/probe.js'
import { runKeyboardFixture } from './keyboard/fixture.js'

// Check 'long-way': how many presses of Tab it takes to reach the content.
//
// P is the number of the first stop inside the content, which is also the
// number of presses. The content starts at the main landmark; with no main
// landmark, after the first heading, but only when that heading is an h1.
// With neither, nothing is reported.
//
// Reported when, before stop P:
//   - there are longWayStops or more stops, not counting stops inside a
//     recognised cookie notice (those are listed in the fact instead)
//   - there is no working skip link (a same-page link as the first stop,
//     cookie notice aside, whose target is on the page)
//   - focus never entered a frame from another site; if it did, the
//     presses inside cannot be counted, so a coverage line is added instead
export default {
  id: 'long-way',
  async beforeWalk({ page }) {
    pageState(page).cookieAtLoad = await page.evaluate(visibleCookieNotice, COOKIE_MARKERS).catch(() => null)
  },
  async onStop(ctx) {
    await probeStop(ctx)
    return []
  },
  async measure(ctx) {
    const s = pageState(ctx.page)
    const stops = ctx.stops || []
    const probes = await Promise.all(stops.map((_, i) => s.probes.get(i + 1)))
    const first = probes.find((p) => p && !p.skip)
    if (!first) return []

    let anchor
    if (first.mainExists) anchor = { kind: 'main' }
    else if (first.heading?.level === 1) anchor = { kind: 'h1', text: first.heading.text }
    else return []

    const index = probes.findIndex((p) => p && !p.skip && (anchor.kind === 'main' ? p.insideMain : p.afterHeading))
    if (index < 0) return []
    const presses = index + 1
    const before = probes.slice(0, index)

    if (before.some((p) => p?.skip === 'frame' && p.stop.crossOrigin)) {
      ctx.note?.(coverageLines.frameBeforeContent)
      return []
    }

    const cookieStops = before.filter((p) => p?.cookie).map((p) => p.step)
    if (before.length - cookieStops.length < stick('keyboard', 'longWayStops')) return []

    const firstOwn = before.find((p) => p && !p.skip && !p.cookie)
    if (firstOwn?.skipLink?.exists) return []

    const maxNames = stick('keyboard', 'maxStopNames')
    const words = (p) => {
      if (!p) return { words: 'a stop we could not read' }
      if (p.skip === 'body') return { words: 'the page itself' }
      if (p.skip === 'frame') return { words: p.stop.crossOrigin ? 'a frame from another site' : 'a frame' }
      if (p.skip) return { name: p.stop.name, role: p.stop.tag }
      return { name: p.name, role: p.role }
    }
    const provider = cookieStops.length ? probes[cookieStops[0] - 1].cookie : null
    const target = probes[index]

    return [{
      detector: 'long-way',
      profile: 'keyboard-only',
      selector: target.stop.selector,
      step: presses,
      ...longWayCopy({
        persona: personaName(ctx),
        presses,
        anchor,
        before: before.slice(0, maxNames).map(words),
        moreBefore: Math.max(0, before.length - maxNames),
        cookie: provider ? { stops: cookieStops, provider, openAtLoad: s.cookieAtLoad === provider } : null,
        skip: firstOwn?.skipLink
          ? { kind: 'broken', name: firstOwn.name, role: firstOwn.role, id: firstOwn.skipLink.id }
          : { kind: 'none' }
      }),
      evidence: { presses, anchor: anchor.kind, cookieStops, skipLink: firstOwn?.skipLink ?? null }
    }]
  },
  // The recorded walk reaching the same element at stop P is the check
  // (done by the persona flow before this is asked).
  confirm: () => true,
  runFixture: (browser, opts) => runKeyboardFixture(browser, opts, 'long-way')
}
