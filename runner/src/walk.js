import { config } from './config.js'
import { settle, describeActive } from './pageScripts.js'

// Presses Tab through the page, one stop at a time, and describes what has
// focus after each press. Observe only: Tab is the only key used here.
//
// When focus moves to the body after the last element, that is the wrap
// signal, not a stop: the next Tab lands back on the first stop. If it does
// not, the body visit was focus getting lost mid-way, and it is kept as a
// stop so a later detector can see it.
//
// Ends at maxStops, on wrap, when there is nothing to focus, or at the
// deadline.
export async function tabWalk(page, { deadline, paceMs = 0, onStop } = {}) {
  const stops = []
  let first = null
  let presses = 0

  async function press() {
    await page.keyboard.press('Tab')
    presses++
    await page.evaluate(settle)
    // Measure before anything is drawn for this stop.
    return page.evaluate(describeActive)
  }

  async function record(stop) {
    stops.push(stop)
    if (onStop) await onStop(stop, stops.length)
    if (paceMs) await page.waitForTimeout(paceMs)
  }

  let pending = null // a stop already read by a look-ahead press
  while (stops.length < config.walk.maxStops) {
    if (Date.now() >= deadline) return { stops, ended: 'time', presses }

    const stop = pending || await press()
    pending = null

    if (stop.kind === 'body') {
      const next = await press()
      if (!first) {
        // Nothing focused yet and Tab keeps landing on the body.
        if (next.kind === 'body') return { stops, ended: 'nothing-focusable', presses }
        pending = next
        continue
      }
      if (next.kind !== 'body' && next.selector === first) return { stops, ended: 'wrapped', presses }
      // Focus fell to the body mid-way: keep it as a stop.
      await record(stop)
      pending = next
      continue
    }

    if (first && stop.selector === first) return { stops, ended: 'wrapped', presses }
    if (!first) first = stop.selector
    await record(stop)
  }
  return { stops, ended: 'max', presses }
}
