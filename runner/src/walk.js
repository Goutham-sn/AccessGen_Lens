import { config } from './config.js'
import { stick } from './measuringStick.js'
import { settle, describeActive } from './pageScripts.js'

// Presses Tab through the page, one stop at a time, and describes what has
// focus after each press. Observe only: Tab is the only key used here.
//
// When focus moves to the body after the last element, that is the wrap
// signal, not a stop: the next Tab lands back on the first stop. If it does
// not, the body visit was focus getting lost mid-way, and it is kept as a
// stop so a later detector can see it.
//
// Chromium always passes through the body when Tab wraps on its own. When
// focus comes back to a place it has already been without that, the page
// is moving focus round in a circle. The walk keeps going until the same
// places have come round in the same order trapRounds times, then ends with
// 'cycle'. A stop seen before is marked `revisit`, so detectors measure
// each place once.
//
// Focus inside a frame shows up as the frame element, press after press.
// Those stops are never treated as a circle (see findCycle).
//
// Ends at maxStops, on wrap, on a cycle, when there is nothing to focus, or
// at the deadline. beforePress and afterPress(stop) run around every press;
// whatever afterPress returns is added to that press's stop.
export async function tabWalk(page, { deadline, paceMs = 0, onStop, beforePress, afterPress } = {}) {
  const stops = []
  const seen = new Set()
  let first = null
  let presses = 0

  async function press() {
    if (beforePress) await beforePress()
    await page.keyboard.press('Tab')
    presses++
    await page.evaluate(settle)
    // Measure before anything is drawn for this stop.
    const stop = await page.evaluate(describeActive)
    const extra = afterPress ? await afterPress(stop) : null
    return extra ? { ...stop, ...extra } : stop
  }

  async function record(stop) {
    if (stop.kind === 'element') {
      if (seen.has(stop.selector)) stop.revisit = true
      seen.add(stop.selector)
    }
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

    if (!first) first = stop.selector
    await record(stop)
    const cycle = findCycle(stops, stick('keyboard', 'trapRounds'))
    if (cycle) return { stops, ended: 'cycle', presses, cycle }
  }

  // At the stop limit, one more press shows whether the page has more
  // stops: a place not seen yet means it does; the page itself followed by
  // the first stop means the walk had in fact seen them all.
  if (Date.now() < deadline) {
    let next = pending || await press()
    if (next.kind === 'body') {
      next = await press()
      if (next.kind !== 'body' && next.selector === first) return { stops, ended: 'wrapped', presses }
    }
    const unseen = next.kind === 'frame'
      ? !stops.some((s) => s.selector === next.selector)
      : next.kind === 'element' && !seen.has(next.selector)
    return { stops, ended: 'max', presses, more: unseen }
  }
  return { stops, ended: 'max', presses, more: false }
}

// The last stops are the same k element stops in the same order, `rounds`
// times over. Returns { fromStep, k, rounds, presses } (fromStep is 1-based)
// or null. Frame and body stops never form a cycle, and neither does one
// place on its own: focus moving inside a closed shadow root also shows up
// as the same element press after press, and we cannot tell the two apart.
export function findCycle(stops, rounds) {
  const n = stops.length
  for (let k = 2; k * rounds <= n; k++) {
    const tail = stops.slice(n - k * rounds)
    if (tail.some((s) => s.kind !== 'element')) continue
    const loop = tail.slice(0, k).map((s) => s.selector)
    if (new Set(loop).size !== k) continue
    if (tail.every((s, i) => s.selector === loop[i % k])) {
      return { fromStep: n - k * rounds + 1, k, rounds, presses: k * rounds }
    }
  }
  return null
}
