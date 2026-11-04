import { config } from './config.js'
import { stick } from './measuringStick.js'
import { pressAndDescribe, findCycle } from './walk.js'
import { TASK_LIMITS } from '../../backend/src/config/runnerCapabilities.js'
import { settle, contentState, describeContext, describeActivation, documentStamp } from './pageScripts.js'

// Task Mode: instead of walking every stop on the page (walk.js), a persona
// is given an ordered list of things to find and goes after them one at a
// time, Tab by Tab, the way that person could.
//
// What the persona can do is the same small set as the walk:
//   - Tab, and read what has focus
//   - Enter on a link to a page on the same site, or on a button that does
//     not submit a form, and only on a place that matches what it is looking
//     for, and only to get to the next thing on the list
// It never types, never submits a form, never clicks, and never reads the
// page ahead of itself: a place is judged when focus gets there.
//
// What the persona can make out depends on who it is (see scoreStop):
//   screen-reader  only what is announced
//   tunnel-vision  only what is near the middle of the screen or near the
//                  place it was just at
//   otherwise      the words on the page
//
// A list ends one of three ways (`ended`):
//   done     every intent was reached
//   failed   one was not; the ones after it are 'not-attempted'
//   stopped  one was reached but Enter on it would leave what Task Mode
//            allows (another site, a new tab, a form submit); the ones after
//            it are 'not-attempted'. This is the runner's limit, not the
//            persona's, so it is not a failure.

// Every reason a failure can carry (task_failures.reason). budget-time is the
// run's own time limit; the rest are what the persona met on the page.
export const TASK_FAILURE_REASONS = ['budget-stops', 'budget-time', 'wrapped', 'trapped', 'nothing-focusable']

// The task a job carries, checked again here: the queue is internal, but a
// malformed list should stop the run with a plain reason, not walk the page.
// Returns { goal, intents }.
export function readTask(raw) {
  const intents = raw?.intents
  const ok = Array.isArray(intents) && intents.length >= 1 && intents.length <= TASK_LIMITS.intents &&
    intents.every((t) => typeof t === 'string' && t.trim() && t.length <= TASK_LIMITS.intentChars)
  if (!ok) {
    throw Object.assign(new Error('unreadable task'), {
      plain: 'This run asked us to find things on the page, but the list could not be read, so we stopped.'
    })
  }
  return { goal: typeof raw.goal === 'string' ? raw.goal : '', intents: intents.map((t) => t.trim()) }
}

const FILLER = new Set([
  'a', 'an', 'the', 'to', 'go', 'find', 'reach', 'open', 'get', 'see', 'view', 'visit', 'look', 'my', 'your',
  'our', 'me', 'on', 'of', 'for', 'and', 'into', 'in', 'with', 'page'
])

// Words in an intent that name a kind of place instead of a name, and the
// kinds of place (see kindsOf) that satisfy them.
const KIND_WORDS = {
  form: 'form', button: 'button', link: 'link', nav: 'nav', navigation: 'nav', menu: 'nav', footer: 'footer', header: 'header'
}

const words = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').split(' ')
  .filter(Boolean).map((w) => (w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))

const nameWords = (text) => new Set(words(text).filter((w) => !FILLER.has(w)))

function dice(a, b) {
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const w of a) if (b.has(w)) shared++
  return (2 * shared) / (a.size + b.size)
}

// Areas whose heading or legend is their title.
const TITLED = new Set(['form', 'region', 'search', 'aside'])

// The kinds of place a stop is: what it is, and what it sits inside.
export function kindsOf(stop) {
  const kinds = new Set((stop.landmarks || []).map((l) => l.kind))
  if (stop.tag === 'a' || stop.role === 'link') kinds.add('link')
  if (stop.tag === 'button' || stop.role === 'button') kinds.add('button')
  if (stop.tag === 'input' || stop.tag === 'select' || stop.tag === 'textarea') kinds.add('field')
  return kinds
}

const centreOf = (rect) => (rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null)
const far = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

// With tunnel vision a place can be made out when it is near the middle of the
// screen, or near the place the person was just at: within tunnelRadiusPx of
// either. `here` and `previousCentre` are in viewport coordinates (previousCentre
// is null for the first place). The one definition, used by scoreStop for the
// real run and by the page pre-check, so they cannot drift apart.
export function madeOutNarrow(here, previousCentre, viewport = config.viewport) {
  if (!here) return false
  const radius = stick('task', 'tunnelRadiusPx')
  const middle = { x: viewport.width / 2, y: viewport.height / 2 }
  return far(here, middle) <= radius || (previousCentre !== null && far(here, previousCentre) <= radius)
}

// Who the persona is, for what it can make out. A screen reader hears the
// page; tunnel vision only sees part of it; anyone else reads it.
export function perceptionFor(profileIds = []) {
  if (profileIds.includes('screen-reader')) return 'hearing'
  if (profileIds.includes('tunnel-vision')) return 'narrow'
  return 'reading'
}

// The one profile a failure is filed under.
export function primaryProfile(profileIds = []) {
  if (profileIds.includes('screen-reader')) return 'screen-reader'
  if (profileIds.includes('tunnel-vision')) return 'tunnel-vision'
  return profileIds[0] || 'keyboard-only'
}

// How well one stop matches one intent, from what this persona can make out
// of it. Pure: it reads the stop it is given and nothing else.
//
// stop: a describeActive stop with the describeContext fields on it
//       (visibleText, accessibleName, landmarks)
// view: { profileIds, viewport: { width, height },
//         previousCentre: { x, y } | null }  (previousCentre in viewport
//         coordinates, as the stop's rect is)
//
// Returns { score, scoreIfSeen, perceived }. score is 0..1; it is 0 when the
// persona cannot make the stop out. scoreIfSeen is what it would have been
// with full sight, so a miss can say "it was there, just out of view".
//
// The words of the intent are matched to the stop's own words, or (at 0.8)
// to the words of the area it sits in, so the first field of a form named
// "Checkout" matches "checkout". When the intent says what kind of place it
// wants ("form", "button"), a stop of another kind is halved; an intent that
// is only a kind ("reach the form") matches any stop of that kind.
export function scoreStop(stop, intent, { profileIds = [], viewport = config.viewport, previousCentre = null } = {}) {
  const mode = perceptionFor(profileIds)
  if (stop.kind !== 'element') return { score: 0, scoreIfSeen: 0, perceived: true }

  const asked = words(intent)
  const wanted = new Set(asked.filter((w) => KIND_WORDS[w]).map((w) => KIND_WORDS[w]))
  const wanting = nameWords(asked.filter((w) => !KIND_WORDS[w]).join(' '))

  const own = mode === 'hearing' ? stop.accessibleName : stop.visibleText
  // A person who can see an area reads its heading when it has no name; only
  // for areas a heading titles. The heading of a whole page would make every
  // control on it match.
  const around = (stop.landmarks || []).map((l) => (mode === 'hearing' ? l.name : (l.name || (TITLED.has(l.kind) ? l.heading : ''))))
  const base = Math.max(
    dice(wanting, nameWords(own)),
    ...around.map((text) => 0.8 * dice(wanting, nameWords(text)))
  )

  const kinds = kindsOf(stop)
  const kindMatch = [...wanted].some((k) => kinds.has(k))
  let scoreIfSeen
  if (!wanted.size) scoreIfSeen = base
  else if (!wanting.size) scoreIfSeen = kindMatch ? 1 : 0
  else scoreIfSeen = kindMatch ? base : base * 0.5

  let perceived = true
  if (mode === 'narrow') {
    perceived = madeOutNarrow(centreOf(stop.rect), previousCentre, viewport)
  }
  return { score: perceived ? scoreIfSeen : 0, scoreIfSeen, perceived }
}

// The few fields of a stop that are kept in a result or a failure record.
function compact(stop) {
  if (!stop) return null
  const { kind, selector, name, tag, role, rect, press, page } = stop
  return { kind, selector, name, tag, role, rect, press, page }
}

// Goes after each intent in order.
//
// opts: { intents: string[], profileIds, deadline, budget: { stopsPerIntent },
//         paceMs, onStop(stop, n, intentIndex), onIntent(outcome, index),
//         onActivate(stop, enterCount) just before Enter is pressed,
//         onBeforePress(previous) just before each Tab, with the page-space centre
//         { x, y } of the stop being left (null on a new page),
//         onDocument() once a new page has loaded after Enter, so whatever is
//         drawn on a page (the persona's view, the overlay) can be put on it again }
//
// Returns {
//   stops       every stop, in order: a describeActive stop plus
//               { press, page, score, perceived, visibleText, accessibleName, landmarks }
//               (press counts Tab on this page; page counts documents)
//   outcomes    one per intent, in order:
//               { intent, index, status: 'reached' | 'failed' | 'not-attempted',
//                 reason, stop, score, stopsAttempted, elapsedMs, missed }
//               stop: where it was reached, or the last place it got to;
//               missed: null, or a place that matched but was out of sight,
//               { stop, score, from } (from: where the person was coming from,
//               in page coordinates, or null)
//   failure     null, or the first intent that failed:
//               { intent, intentIndex, lastStop, missed, stopsAttempted, elapsedMs, profile, reason }
//               reason: 'budget-stops' | 'budget-time' | 'wrapped' | 'trapped' | 'nothing-focusable'
//   ended       'done' | 'failed' | 'stopped'
//   stoppedBecause  null, or why Enter was not pressed (from describeActivation)
//   tabs, enters
// }
export async function taskWalk(page, { intents, profileIds = [], deadline, budget = {}, paceMs = 0, onStop, onIntent, onActivate, onBeforePress, onDocument } = {}) {
  if (!Array.isArray(intents)) throw new TypeError('taskWalk needs a list of intents')
  const maxStops = budget.stopsPerIntent ?? config.task.stopsPerIntent
  const matchScore = stick('task', 'matchScore')
  const profile = primaryProfile(profileIds)

  const outcomes = intents.map((intent, index) => ({
    intent, index, status: 'not-attempted', reason: null, stop: null, score: null, stopsAttempted: 0, elapsedMs: 0, missed: null
  }))
  const stops = []
  let tabs = 0
  let enters = 0
  let failure = null
  let ended = 'done'
  let stoppedBecause = null

  // State of the document being walked. A new document starts all of it over.
  let pageNo = 0
  let pageTabs = 0
  let first = null // selector of the first stop on this document
  let current = null // the last element stop on this document
  let pageStops = [] // for cycle detection
  let previous = null // page-space centre of the stop before
  let pending = null // a stop already read by a look-ahead press
  function newDocument() {
    pageNo++
    pageTabs = 0
    first = null
    current = null
    pageStops = []
    previous = null
    pending = null
  }

  async function press() {
    if (onBeforePress) await onBeforePress(previous)
    const stop = await pressAndDescribe(page, 'Tab')
    tabs++
    pageTabs++
    const out = { ...stop, press: pageTabs, page: pageNo }
    if (stop.kind === 'element') {
      const ctx = await page.evaluate(describeContext)
      if (ctx) {
        const { scroll, ...said } = ctx
        Object.assign(out, said)
        out.scroll = scroll
        // The name is what this persona makes of the stop, so a labelled field
        // is not "unnamed" and a link a screen reader cannot hear is.
        out.name = perceptionFor(profileIds) === 'hearing' ? said.accessibleName : said.visibleText
      }
    }
    return out
  }

  // Enter on the place that was reached. Watches briefly for a new document.
  async function activate() {
    const before = await page.evaluate(documentStamp)
    await page.keyboard.press('Enter')
    enters++
    const until = Math.min(Date.now() + config.task.activationWaitMs, deadline)
    let changed = false
    while (Date.now() < until) {
      await page.waitForTimeout(100)
      // null: the document is being replaced right now.
      const now = await page.evaluate(documentStamp).catch(() => null)
      if (now === null || now !== before) { changed = true; break }
    }
    if (!changed) {
      await page.evaluate(settle).catch(() => {})
      return
    }
    newDocument()
    const loadCap = Math.max(0, Math.min(config.load.loadEventCapMs, deadline - Date.now()))
    await page.waitForLoadState('load', { timeout: loadCap }).catch(() => {})
    const readyBy = Math.min(Date.now() + config.load.readyCapMs, deadline)
    while (Date.now() < readyBy) {
      const state = await page.evaluate(contentState).catch(() => null)
      if (state?.hasContent) break
      await page.waitForTimeout(config.load.readyPollMs)
    }
    await page.evaluate(settle).catch(() => {})
    if (onDocument) await onDocument()
  }

  for (const outcome of outcomes) {
    const startedAt = Date.now()
    const origin = current?.selector ?? null // where focus is as this intent starts
    let attempted = 0
    let last = null
    let reached = null
    let reason = null
    let bodyVisits = 0

    while (true) {
      if (Date.now() >= deadline) { reason = 'budget-time'; break }
      if (attempted >= maxStops) { reason = 'budget-stops'; break }

      const stop = pending || await press()
      pending = null

      if (stop.kind === 'body') {
        const next = await press()
        if (!first) {
          // Nothing focused yet and Tab keeps landing on the body.
          if (next.kind === 'body') { reason = 'nothing-focusable'; break }
          pending = next
          continue
        }
        bodyVisits++
        if (origin === null && next.kind !== 'body' && next.selector === first) { reason = 'wrapped'; break }
        if (origin !== null && bodyVisits >= 2) { reason = 'wrapped'; break }
        // Focus fell to the body mid-way: kept as a stop, not scored.
        stops.push(stop)
        pageStops.push(stop)
        pending = next
        continue
      }

      // Back where this intent started: the whole page has been gone round.
      if (origin !== null && stop.kind === 'element' && stop.selector === origin && attempted > 0) { reason = 'wrapped'; break }

      if (!first) first = stop.selector
      attempted++

      const scroll = stop.scroll || { x: 0, y: 0 }
      delete stop.scroll
      const here = centreOf(stop.rect)
      const verdict = scoreStop(stop, outcome.intent, {
        profileIds,
        viewport: config.viewport,
        previousCentre: previous ? { x: previous.x - scroll.x, y: previous.y - scroll.y } : null
      })
      stop.score = verdict.score
      stop.perceived = verdict.perceived
      const cameFrom = previous // page-space centre of the stop before this one
      if (here) previous = { x: here.x + scroll.x, y: here.y + scroll.y }

      stops.push(stop)
      pageStops.push(stop)
      last = stop
      if (stop.kind === 'element') current = stop

      if (!verdict.perceived && verdict.scoreIfSeen >= matchScore && (!outcome.missed || verdict.scoreIfSeen > outcome.missed.score)) {
        outcome.missed = { stop: compact(stop), score: verdict.scoreIfSeen, from: cameFrom }
      }
      if (onStop) await onStop(stop, stops.length, outcome.index)
      if (paceMs) await page.waitForTimeout(paceMs)

      if (verdict.score >= matchScore) { reached = stop; break }
      if (findCycle(pageStops, stick('keyboard', 'trapRounds'))) { reason = 'trapped'; break }
    }

    outcome.stopsAttempted = attempted
    outcome.elapsedMs = Date.now() - startedAt
    outcome.stop = compact(reached || last)

    if (!reached) {
      outcome.status = 'failed'
      outcome.reason = reason
      failure = {
        intent: outcome.intent,
        intentIndex: outcome.index,
        lastStop: compact(last),
        missed: outcome.missed,
        stopsAttempted: attempted,
        elapsedMs: outcome.elapsedMs,
        profile,
        reason
      }
      ended = 'failed'
      for (const later of outcomes.slice(outcome.index + 1)) later.reason = 'earlier-intent-failed'
      if (onIntent) await onIntent(outcome, outcome.index)
      break
    }

    outcome.status = 'reached'
    outcome.score = reached.score
    if (outcome.index < outcomes.length - 1 && (reached.tag === 'a' || reached.tag === 'button')) {
      const act = await page.evaluate(describeActivation)
      if (!act.ok) {
        ended = 'stopped'
        stoppedBecause = act.why
        for (const later of outcomes.slice(outcome.index + 1)) later.reason = act.why
        if (onIntent) await onIntent(outcome, outcome.index)
        break
      }
      if (onActivate) await onActivate(reached, enters + 1)
      await activate()
    }
    if (onIntent) await onIntent(outcome, outcome.index)
  }

  return { stops, outcomes, failure, ended, stoppedBecause, tabs, enters }
}
