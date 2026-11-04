import { config } from './config.js'
import { stick } from './measuringStick.js'
import { newSafeContext } from './browser.js'
import { loadPage } from './load.js'
import { checkBotWall } from './botWall.js'
import { madeOutNarrow } from './task.js'
import { decodePng, changedShare } from './png.js'
import { Deuteranopia } from '../../extension/profiles/visual/Deuteranopia.js'

// The pre-check: one quick look at a page before anyone commits to a run.
// One page load with the runner's own readiness rule (so a page that fills in
// after it loads is seen as a person would see it), no persona, no recording
// and no walk. It counts and measures; it never judges. What it says is how
// much there is for a person's way of using the page to act on, not whether
// that is done well.
//
// Four signals come from that one render:
//   reachableStops  how many places Tab can reach
//   textAmount      how much text there is to read
//   colourChange    how much of the first screen looks different through the
//                   red-green filter the run applies
//   unseenStops     how many Tab stops tunnel vision would not make out, going
//                   from one to the next (the rule the real run uses)

export const COULD_NOT_CHECK = 'We could not check this page ahead of time.'
export const BOT_WALL = 'This page asks visitors to prove they are human, so we could not look at it ahead of time.'
export const TOOK_TOO_LONG = 'The page took too long to look at ahead of time.'

const MAX_STOPS = 1000 // stops kept for the tunnel-vision count; a page with more is not a small one

// The same matrix the run's filter uses, read from the profile itself.
const DEUTERANOPIA = new Deuteranopia(3).matrix

// Runs in the page, once. Returns what the four signals need:
//   count/frames/truncated  the places Tab can reach (visible, enabled, tab
//                           index 0 or more; one per group of radio buttons;
//                           open shadow roots included; frames not entered)
//   stops                   those places in DOM order, as [x, y, width, height,
//                           tabIndex, fixed] in page coordinates at the top of
//                           the page. fixed: stays put when the page scrolls.
//                           A place that rests off the page or one pixel big (a
//                           skip link) is focused for a moment to read where it
//                           appears, as it does for a person pressing Tab
//   textChars, bigMedia     the text on the page, and pictures/video/canvas
//                           large enough to carry meaning of their own
//   scrollMax, view         how far the page scrolls, and the window size
export function scanScript({ bigMediaPx, maxStops }) {
  const REACHABLE = 'a[href], area[href], button, input:not([type="hidden"]), select, textarea, summary, ' +
    'audio[controls], video[controls], [tabindex], [contenteditable]:not([contenteditable="false"])'
  const NODE_CAP = 20000
  let visited = 0
  let truncated = false
  let count = 0
  const groups = new Set()
  const formIds = new WeakMap()
  let formNo = 0
  const found = []

  function reachable(el) {
    if (el.tabIndex < 0) return false
    if (el.matches(':disabled') || el.closest('[inert]')) return false
    // The element's whole box, as the Tab walk reads it: an inline link around a block (a
    // vote arrow) has an empty first line box but a box of its own.
    const box = el.getBoundingClientRect()
    if (!el.getClientRects().length || (!box.width && !box.height)) return false
    const visibility = getComputedStyle(el).visibility
    return visibility !== 'hidden' && visibility !== 'collapse'
  }

  function walk(root) {
    for (const el of root.querySelectorAll('*')) {
      if (++visited > NODE_CAP) { truncated = true; return }
      if (el.shadowRoot) walk(el.shadowRoot)
      if (truncated || !el.matches(REACHABLE) || !reachable(el)) continue
      if (el.tagName === 'INPUT' && el.type === 'radio' && el.name) {
        const form = el.form
        if (form && !formIds.has(form)) formIds.set(form, ++formNo)
        const key = `${form ? formIds.get(form) : 0}|${el.name}`
        if (groups.has(key)) continue
        groups.add(key)
      }
      count++
      if (found.length < maxStops) found.push(el)
    }
  }

  window.scrollTo({ left: 0, top: 0, behavior: 'instant' })
  walk(document)

  const view = { w: window.innerWidth, h: window.innerHeight }
  const scrollMax = {
    x: Math.max(0, document.documentElement.scrollWidth - view.w),
    y: Math.max(0, document.documentElement.scrollHeight - view.h)
  }
  const rectOf = (el) => { const r = el.getBoundingClientRect(); return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }
  const before = found.map(rectOf)
  // Skip links wait off the page (or 1px big) and show up when focused. Focus a
  // few of them to see where, then put focus back.
  const pageW = document.documentElement.scrollWidth
  const pageH = document.documentElement.scrollHeight
  let probes = 0
  found.forEach((el, i) => {
    const [x, y, w, h] = before[i]
    const atRestOutOfSight = x + w <= 0 || y + h <= 0 || x >= pageW || y >= pageH || (w <= 2 && h <= 2)
    if (!atRestOutOfSight || probes >= 20) return
    probes++
    try {
      el.focus({ preventScroll: true })
      const shown = rectOf(el)
      el.blur()
      if (shown[2] > 2 || shown[3] > 2) before[i] = shown
    } catch { /* stays where it rests */ }
  })
  window.scrollTo({ left: 0, top: 0, behavior: 'instant' })
  // A place that does not move when the page scrolls by a pixel is fixed to
  // the window (a pinned bar), so scrolling never brings it closer.
  const rest = found.map(rectOf) // where they rest, for the fixed test
  let fixed = found.map(() => false)
  if (scrollMax.y >= 1) {
    window.scrollTo({ left: 0, top: 1, behavior: 'instant' })
    const moved = found.map((el) => el.getBoundingClientRect().top)
    fixed = found.map((el, i) => Math.abs(moved[i] - rest[i][1]) < 0.5)
    window.scrollTo({ left: 0, top: 0, behavior: 'instant' })
  }
  const stops = found.map((el, i) => [...before[i], el.tabIndex, fixed[i]])

  let frames = 0
  for (const f of document.querySelectorAll('iframe, frame')) {
    const r = f.getBoundingClientRect()
    if (r.width >= 100 && r.height >= 100) frames++
  }
  let bigMedia = 0
  for (const m of document.querySelectorAll('img, video, canvas, svg')) {
    const r = m.getBoundingClientRect()
    if (r.width * r.height >= bigMediaPx) bigMedia++
  }
  return {
    count, frames, truncated, stops, view, scrollMax, bigMedia,
    textChars: (document.body?.innerText || '').trim().length
  }
}

// none | few | unsure | plenty. A page whose content sits in a frame can show
// few stops here and many to a person, so it is "unsure", never "none".
export function levelFor({ count, frames, truncated }) {
  if (truncated || count > stick('precheck', 'fewStops')) return 'plenty'
  if (frames > 0) return 'unsure'
  return count === 0 ? 'none' : 'few'
}

// none | little | unsure | plenty. Text can also be in a picture or a frame, so
// a page short of text with either is "unsure", never "none" or "little".
export function textLevel({ textChars, frames, bigMedia }) {
  if (textChars >= stick('precheck', 'littleTextChars')) return 'plenty'
  if (frames > 0 || bigMedia > 0) return 'unsure'
  return textChars <= stick('precheck', 'noTextChars') ? 'none' : 'little'
}

// little | some | lots, by how much of the first screen changes colour.
export function colourLevel(share) {
  if (share < stick('precheck', 'littleColourShare')) return 'little'
  return share < stick('precheck', 'lotsColourShare') ? 'some' : 'lots'
}

// Where one axis of the page ends up when Chromium scrolls a Tab stop into
// view. A stop already wholly on screen does not scroll the page; one partly on
// screen is moved to the nearest edge; one wholly off screen is centred; and
// the page can never scroll past its ends. Measured on Chromium (see
// precheck.test.js, which checks it against a real Tab walk).
export function landAxis(start, size, scroll, viewSize, max) {
  const end = start + size
  if (start >= scroll && end <= scroll + viewSize) return scroll
  const partlyVisible = end > scroll && start < scroll + viewSize
  let next
  if (partlyVisible) next = start < scroll || size > viewSize ? start : end - viewSize
  else next = start + size / 2 - viewSize / 2
  return Math.min(max, Math.max(0, next))
}

// In Tab order: stops with a positive tab index first, lowest first, then the
// rest in page order.
function inTabOrder(stops) {
  const positive = stops.filter((s) => s[4] > 0).sort((a, b) => a[4] - b[4])
  return [...positive, ...stops.filter((s) => s[4] <= 0)]
}

// How many of the stops tunnel vision would not make out, pressing Tab from
// the first to the last: the real run's rule (madeOutNarrow in task.js), with
// each stop placed where the page lands when it is scrolled into view.
export function unseenStops(stops, { view, scrollMax }) {
  const viewport = { width: view.w, height: view.h }
  let scroll = { x: 0, y: 0 }
  let previousPage = null
  let unseen = 0
  const ordered = inTabOrder(stops)
  for (const [x, y, w, h, , fixed] of ordered) {
    if (!fixed) {
      scroll = {
        x: landAxis(x, w, scroll.x, view.w, scrollMax.x),
        y: landAxis(y, h, scroll.y, view.h, scrollMax.y)
      }
    }
    const here = { x: x - (fixed ? 0 : scroll.x) + w / 2, y: y - (fixed ? 0 : scroll.y) + h / 2 }
    const previousView = previousPage ? { x: previousPage.x - scroll.x, y: previousPage.y - scroll.y } : null
    if (!madeOutNarrow(here, previousView, viewport)) unseen++
    previousPage = { x: here.x + scroll.x, y: here.y + scroll.y }
  }
  return { unseen, of: ordered.length }
}

// none | few | some | lots | unsure, by how many places are out of view (see
// fewOutOfSight and lotsOutOfSight in the measuring stick for why a count, and
// not a share). Frames are not entered, and a page with no places to reach has
// nothing to go between.
export function unseenLevel({ unseen, of, frames, truncated }) {
  if (truncated || frames > 0 || of === 0) return 'unsure'
  if (unseen === 0) return 'none'
  if (unseen <= stick('precheck', 'fewOutOfSight')) return 'few'
  return unseen >= stick('precheck', 'lotsOutOfSight') ? 'lots' : 'some'
}

// One loaded page in, one plain result out. No browser here, so tests can use
// their own context. screenshotMs: the most the picture may take.
export async function precheckPage(page, url, { deadline, screenshotMs = 1500 }) {
  const loaded = await loadPage(page, url, { deadline })
  if (!loaded.ok) return { ok: false, reason: loaded.reason }
  const wall = await checkBotWall(page, loaded.status)
  if (wall.wall) return { ok: false, reason: BOT_WALL }
  const seen = await page.evaluate(scanScript, { bigMediaPx: stick('precheck', 'bigMediaPx'), maxStops: MAX_STOPS }).catch(() => null)
  if (!seen) return { ok: false, reason: COULD_NOT_CHECK }

  const result = {
    ok: true,
    checkedAt: new Date().toISOString(),
    readyMs: loaded.readyMs,
    changing: loaded.changing,
    reachableStops: { count: seen.count, level: levelFor(seen) },
    textAmount: { chars: seen.textChars, level: textLevel(seen) }
  }

  const gaps = unseenStops(seen.stops, seen)
  const stopsTruncated = seen.truncated || seen.count > seen.stops.length
  result.unseenStops = { count: gaps.unseen, of: gaps.of, level: unseenLevel({ ...gaps, frames: seen.frames, truncated: stopsTruncated }) }

  // The picture is the one thing that can fail on its own (a page that never
  // finishes drawing); the rest still stands without it.
  try {
    const picture = decodePng(await page.screenshot({ type: 'png', animations: 'disabled', caret: 'hide', timeout: screenshotMs }))
    const share = changedShare(picture, DEUTERANOPIA, { delta: stick('precheck', 'colourDelta') })
    result.colourChange = { share: Math.round(share * 1000) / 1000, level: colourLevel(share) }
  } catch { /* no colour signal this time */ }
  return result
}

// The queue's job. Takes its own context from the pre-check's own cap, closes
// it whatever happens, and never throws: a person gets a plain line either way.
export async function runPrecheck(url, { browser, sem, blockedHosts, log = console }) {
  let parsed
  try { parsed = new URL(url) } catch { return { ok: false, reason: COULD_NOT_CHECK } }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { ok: false, reason: COULD_NOT_CHECK }

  await sem.acquire('precheck')
  const deadline = Date.now() + config.precheck.deadlineMs
  let context
  try {
    context = await newSafeContext(browser, { blockedHosts })
    const page = await context.newPage()
    // A hard stop a little after the deadline (room for the picture), in case
    // the page or the browser hangs.
    let timer
    const stop = new Promise((resolve) => { timer = setTimeout(() => resolve({ ok: false, reason: TOOK_TOO_LONG }), config.precheck.deadlineMs + 2500) })
    try {
      return await Promise.race([precheckPage(page, parsed.toString(), { deadline }), stop])
    } finally {
      clearTimeout(timer)
    }
  } catch (err) {
    log.error?.('[runner] precheck failed:', String(err?.message || err).slice(0, 200))
    return { ok: false, reason: COULD_NOT_CHECK }
  } finally {
    if (context) await Promise.race([context.close().catch(() => {}), new Promise((r) => setTimeout(r, 3000))])
    sem.release('precheck')
  }
}
