// Words the runner puts on screen and in moments. Third person, plain words,
// no verdicts. The keyboard detector templates are at the end.

// How each filter profile reads in a sentence.
const CONDITION_WORDS = {
  deuteranopia: 'red-green colour blindness',
  achromatopsia: 'colour blindness',
  'low-vision': 'low vision',
  'tunnel-vision': 'tunnel vision'
}

const MAX_PAGE_TEXT = 80
// Control characters (C0 and C1), and the bidirectional overrides and
// isolates that can make text display in a different order than it reads.
const UNSAFE_CHARS = /[\u0000-\u001F\u007F-\u009F\u200E\u200F\u202A-\u202E\u2066-\u2069]/g

// Any text taken from the page under test (an accessible name, the name of
// something covering an element): control characters removed, whitespace
// collapsed, at most 80 characters. It is always shown as text, never as
// markup; escaping is the job of whatever renders it.
export function cleanPageText(raw) {
  const text = String(raw ?? '').replace(UNSAFE_CHARS, ' ').replace(/\s+/g, ' ').trim()
  return text.length > MAX_PAGE_TEXT ? `${text.slice(0, MAX_PAGE_TEXT - 1)}…` : text
}

// A page-derived name ready for a sentence: cleaned, or "an unnamed
// {role}" when there is nothing to show.
export function pageName(raw, role) {
  const text = cleanPageText(raw)
  return text || `an unnamed ${cleanPageText(role) || 'element'}`
}

// The caption line shown while the persona's filter is paused for a moment,
// or null when the persona has no filter on the page.
export function pauseNote(name, profiles) {
  const words = (profiles || []).map((p) => CONDITION_WORDS[p.id]).filter(Boolean)
  if (!name || words.length === 0) return null
  return `Showing the page without ${name}'s ${words.join(' and ')} so it is readable.`
}

// ------------------------------------------------------------------------
// Keyboard detector templates. One per detector, names only (no pronouns).
// Every number in a fact is a measurement. Page-derived text goes through
// cleanPageText here; whatever shows it escapes it.

// Plain words for the roles the browser's accessibility tree reports.
const ROLE_WORDS = {
  textbox: 'text field',
  searchbox: 'search field',
  combobox: 'combo box',
  radio: 'radio button',
  menuitem: 'menu item',
  menuitemcheckbox: 'menu item',
  menuitemradio: 'menu item',
  spinbutton: 'number field',
  listbox: 'list box',
  tabpanel: 'tab panel',
  contentinfo: 'footer',
  complementary: 'side panel',
  alertdialog: 'dialog',
  img: 'image'
}

// The role as words: from the accessibility tree, or "{tag} element" when
// the browser gives it no particular role.
export function roleWord(axRole, tag) {
  const role = cleanPageText(axRole)
  if (role && role !== 'generic' && role !== 'none' && role !== 'presentation') return ROLE_WORDS[role] || role
  const t = cleanPageText(tag).toLowerCase()
  return t ? `${t} element` : 'element'
}

// “Search” (button), or "an unnamed button".
export function named(name, role) {
  const text = cleanPageText(name)
  const r = cleanPageText(role) || 'element'
  return text ? `“${text}” (${r})` : `an unnamed ${r}`
}

// “Search”, or "an unnamed button": for lists, where roles would crowd.
export function nameOnly(name, role) {
  const text = cleanPageText(name)
  return text ? `“${text}”` : pageName('', role)
}

// "a", "a and b", "a, b and c"
function listWords(items) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`
}

// "Stop 2 is", "Stops 1 to 4 are", "Stops 1, 2 and 5 are"
function stopsAre(numbers) {
  if (numbers.length === 1) return `Stop ${numbers[0]} is`
  const contiguous = numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1)
  return contiguous
    ? `Stops ${numbers[0]} to ${numbers[numbers.length - 1]} are`
    : `Stops ${listWords(numbers.map(String))} are`
}

export function focusNotVisibleCopy({ persona, step, name, role, nearbyPx, parentsCompared }) {
  const parents = parentsCompared === 0
    ? ''
    : ` and its ${parentsCompared === 1 ? 'nearest parent' : `${parentsCompared} nearest parents`}`
  return {
    headline: `${persona} would press Tab and see no sign of where it went.`,
    fact: `After Tab moved to ${named(name, role)}, stop ${step}, nothing within ${nearbyPx} px of it changed on screen, ` +
      `and its outline, shadow, border, background, underline and transform stayed the same on it${parents}.`,
    forTeam: `Give this ${cleanPageText(role) || 'element'} a visible focus style, such as an outline, that shows when it is reached with Tab.`
  }
}

// anchor: { kind: 'main' } or { kind: 'h1', text }
// before: [{ name, role }] for the first stops before it, or { words } for
// a stop that is not an element ("the page itself", "a frame")
// cookie: null or { stops: [n], provider, openAtLoad }
// skip: { kind: 'none' } or { kind: 'broken', name, role, id }
export function longWayCopy({ persona, presses, anchor, before, moreBefore, cookie, skip }) {
  const parts = []
  parts.push(anchor.kind === 'main'
    ? `Stop ${presses} is the first stop inside the page's main landmark.`
    : `Stop ${presses} is the first stop after the page's first heading, ${nameOnly(anchor.text, 'heading')}, which is an h1. ` +
      'The page has no main landmark, so we used that heading.')
  const names = before.map((s) => s.words ?? nameOnly(s.name, s.role))
  if (moreBefore > 0) names.push(`${moreBefore} more`)
  parts.push(`Before it: ${listWords(names)}.`)
  if (cookie) {
    parts.push(`${stopsAre(cookie.stops)} inside the cookie notice (${cookie.provider}), ` +
      `which ${cookie.openAtLoad ? 'was open when the page loaded' : 'opened after the page loaded'}. We did not close it.`)
  }
  parts.push(skip.kind === 'broken'
    ? `The link ${named(skip.name, skip.role)} points to #${cleanPageText(skip.id)}, which is not on the page.`
    : 'There is no link at the start that jumps to the content.')
  parts.push('A person using a mouse does not need these presses.')
  return {
    headline: `${persona} would have to press Tab ${presses} times to reach the main content.`,
    fact: parts.join(' '),
    forTeam: 'Add a skip link as the first stop that moves to the main content.'
  }
}

const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1)

// "link" -> "links", "text field" -> "text fields", "combo box" -> "combo boxes"
function plural(word) {
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`
  return `${word}s`
}

// A list of elements as short phrases, repeats grouped, in order of first
// appearance: "an unnamed link" or "7 unnamed links", “Read more” or
// “Read more” (3 times). Names are cleaned (control characters out, 80
// characters at most) and never read as markup. Past maxGroups groups, the
// rest are counted: { phrases, more } where `more` is the number of
// elements left out.
export function groupedNames(items, maxGroups = 10) {
  const groups = new Map()
  for (const item of items) {
    const name = cleanPageText(item.name)
    const role = cleanPageText(item.role) || 'element'
    const key = name ? `n:${name}` : `u:${role}`
    const group = groups.get(key) || { name, role, count: 0 }
    group.count++
    groups.set(key, group)
  }
  const all = [...groups.values()]
  const shown = all.slice(0, maxGroups)
  const phrases = shown.map((g) => {
    if (g.name) return g.count === 1 ? `“${g.name}”` : `“${g.name}” (${g.count} times)`
    return g.count === 1 ? `an unnamed ${g.role}` : `${g.count} unnamed ${plural(g.role)}`
  })
  return { phrases, more: all.slice(maxGroups).reduce((n, g) => n + g.count, 0) }
}

// presses: how many presses in a row ended on the page itself.
// flashed: [{ name, role }] elements that had focus for a moment during
// those presses (recorded, never guessed); empty when none was seen, and
// then no cause is given.
export function focusLostToPageCopy({ persona, prevStep, presses = 1, prev, next, flashed = [], maxNames = 10 }) {
  const parts = []
  if (presses === 1) {
    parts.push(`After ${nameOnly(prev.name, prev.role)} (stop ${prevStep}), pressing Tab moved focus to the page itself, not to anything on it.`)
    if (next) parts.push(`The next press went to ${nameOnly(next.name, next.role)}.`)
  } else {
    parts.push(`After ${nameOnly(prev.name, prev.role)} (stop ${prevStep}), the next ${presses} presses of Tab moved focus to the page itself, not to anything on it.`)
    if (next) parts.push(`Press ${prevStep + presses + 1} went to ${nameOnly(next.name, next.role)}.`)
  }
  if (flashed.length) {
    const { phrases, more } = groupedNames(flashed, maxNames)
    if (more > 0) phrases.push(`${more} more`)
    parts.push(`${capitalise(listWords(phrases))} received focus and then lost it.`)
  }
  return {
    headline: presses === 1
      ? `After stop ${prevStep}, ${persona} would lose track of the place on the page.`
      : `${persona} would press Tab ${presses} times in a row and focus would not land on anything.`,
    fact: parts.join(' '),
    forTeam: 'Make sure focus moves to the next control instead of falling back to the page.'
  }
}

// hidden: { kind: 'zero', width, height } | { kind: 'transparent' } | { kind: 'offscreen', x, y }
export function focusLostHiddenCopy({ persona, step, name, role, hidden, label }) {
  const how = hidden.kind === 'zero'
    ? `zero size (${hidden.width} by ${hidden.height} px)`
    : hidden.kind === 'transparent'
      ? 'fully transparent (opacity 0)'
      : `outside the screen, at ${hidden.x}, ${hidden.y}`
  const where = label != null
    ? `its label ${nameOnly(label, 'label')} or its nearest parent`
    : 'its nearest parent'
  return {
    headline: `At stop ${step}, ${persona} would land on something that cannot be seen.`,
    fact: `Stop ${step} is ${named(name, role)}, which is ${how}. When it was reached, nothing changed on screen in ${where}.`,
    forTeam: 'Take hidden items out of the Tab order, or show them when they are reached.'
  }
}

export function focusHiddenCopy({ persona, step, name, role, cover }) {
  const coverWords = named(cover.name, cover.role)
  return {
    headline: `At stop ${step}, ${persona} would not see the place on the page, because ${coverWords} covers it.`,
    fact: `Stop ${step} is ${named(name, role)}. At all 5 points checked on it (its centre and four inner corners), ` +
      `the element on top is ${coverWords}, which is not part of it and is painted over it.`,
    forTeam: 'Keep the focused element in view, for example with scroll padding for sticky headers and banners.'
  }
}

export function trapCopy({ persona, fromStep, k, rounds, presses, places, unreached }) {
  const others = unreached === 1
    ? '1 other focusable element on the page was'
    : `${unreached} other focusable elements on the page were`
  return {
    headline: `${persona} would find Tab going round the same ${k} places.`,
    fact: `From stop ${fromStep}, Tab went round these ${k} elements ${rounds} times in ${presses} presses: ` +
      `${listWords(places.map((p) => nameOnly(p.name, p.role)))}. ${others} never reached. ` +
      'No dialog was open. Escape did not move focus out. ' +
      'We did not press Enter or Space, so we could not tell whether one of these controls leads out.',
    forTeam: 'Let Tab move past this group, or make it a dialog that Escape closes.'
  }
}

// How to check a finding by hand, for the validation list. After "Open
// {url}, ": the presses to count and what to look at. Press counts are
// counted from the start of the page, as the walk counted them.
const times = (n) => `${n} ${n === 1 ? 'time' : 'times'}`
// Where the long-way check took the content to start (its anchor kind).
export const LONG_WAY_ANCHOR_WORDS = {
  main: 'the first stop inside the main landmark',
  h1: "the first stop after the page's first heading, which is an h1"
}
function anchorWords(anchor) {
  const words = LONG_WAY_ANCHOR_WORDS[anchor]
  if (!words) throw new Error(`unknown long-way anchor: ${anchor}`)
  return words
}
export const byHand = {
  focusVisible: ({ press, name, role }) =>
    `press Tab ${times(press)}, look at ${named(name, role)}. Is there any sign that it has focus?`,
  longWay: ({ press, name, role, anchor }) =>
    `press Tab ${times(press)}, look at ${named(name, role)}. Is it ${anchorWords(anchor)}, with nothing before it that skips there?`,
  focusLostHidden: ({ press, name, role }) =>
    `press Tab ${times(press)}, look at ${named(name, role)}. Can you see where focus is?`,
  focusLostToPage: ({ prevPress, prev, presses }) =>
    `press Tab ${times(prevPress)} to reach ${nameOnly(prev.name, prev.role)}, then press Tab ${times(presses)} more. Does focus land on anything you can see?`,
  focusHidden: ({ press, name, role, cover }) =>
    `press Tab ${times(press)}, look at ${named(name, role)}. Is it hidden behind ${named(cover.name, cover.role)}?`,
  trap: ({ press, first, k, more }) =>
    `press Tab ${times(press)} to reach ${nameOnly(first.name, first.role)}, then keep pressing Tab ${times(more)} more. Does focus keep going round the same ${k} places, and does Escape not get you out?`
}

// Why a place that was found was not pressed, in plain words.
const NOT_PRESSED = {
  'leaves-site': 'it leads to another site',
  'new-tab': 'it opens in a new tab',
  'submits-form': 'it would send a form',
  download: 'it downloads a file'
}

// Coverage lines: what we could not look at, in plain words.
export const coverageLines = {
  frameEntered: (step) => `Focus entered a frame from another site at stop ${step}. We could not look inside it.`,
  frameEnteredSameSite: (step) => `Focus entered a frame from this site at stop ${step}. We did not look inside it.`,
  stayedInFrame: 'Tab stayed inside it for the rest of the walk, so we could not look at the rest of the page.',
  frameBeforeContent: 'A frame from another site came before the main content, so we did not count how long it takes to reach it.',
  outOfTime: (step) => `We ran out of time at stop ${step}, so we did not look at the rest of the page.`,
  stopLimit: (presses) => `We pressed Tab ${presses} times and stopped. The page has more stops, which we did not look at.`,
  skipControl: (name) => `The first stops include ${nameOnly(name, 'control')}, which may jump to the content, ` +
    'but it is not a link to a place on this page, so we could not check where it goes.',
  closedSections: (count) => (count === 1
    ? '1 part of the page is in a closed section, so we could not look inside it.'
    : `${count} parts of the page are in closed sections, so we could not look inside them.`),
  taskOutOfTime: (intent) => `We ran out of time while looking for “${cleanPageText(intent)}”, so we do not know whether it can be reached.`,
  taskNotFollowed: (intent, why) => `We found “${cleanPageText(intent)}” but did not press it, because ${NOT_PRESSED[why] || 'we only follow links on the same site and buttons that do not send a form'}. We stopped there.`
}

// ------------------------------------------------------------------------
// Task Mode: a persona was given something to find and did not reach it.
// This is the words people read. The structured record of the same failure
// (reason code, counts) goes to task_failures and never into this text.

const TAG_WORDS = { a: 'link', button: 'button', input: 'field', select: 'menu', textarea: 'text field' }

// A stop from taskWalk as a role word: "link", "button", "text field".
function stopWord(stop) {
  return stop?.role ? roleWord(stop.role, stop.tag) : (TAG_WORDS[stop?.tag] || 'element')
}

const stopCount = (n) => `${n} ${n === 1 ? 'stop' : 'stops'}`

// persona: the persona's name
// profile: the profile the failure is filed under
// intent: the text of what was looked for, from the person who set the goal
// intentNumber (1-based) and intentCount: where it sits in the list
// reason: from taskWalk's failure
// lastStop: the last place reached, or null
// missed: null, or { stop } for a place that matched but was out of sight
// radiusPx: how far from the middle of the screen (or the stop before) a
//   place with tunnel vision can still be made out
//
// Returns { headline, fact, forTeam }, or null when the reason is not
// something the persona met on the page (the time limit is ours, and gets a
// coverage line instead: see coverageLines.taskOutOfTime).
export function taskNotFoundCopy({ persona, profile, intent, intentNumber, intentCount, reason, stopsAttempted, lastStop, missed = null, radiusPx }) {
  const quoted = `“${cleanPageText(intent)}”`
  const verb = profile === 'screen-reader' ? 'listened for' : 'looked for'
  const before = intentNumber - 1
  const place = intentCount > 1
    ? ` It was step ${intentNumber} of ${intentCount}.${before === 0 ? '' : before === 1 ? ' The step before it was reached.' : ` The ${before} steps before it were reached.`}`
    : ''
  const last = lastStop ? ` The last stop was ${named(lastStop.name, stopWord(lastStop))}.` : ''

  if (missed && (reason === 'wrapped' || reason === 'budget-stops')) {
    const seen = missed.stop
    return {
      headline: `${persona} would not notice ${nameOnly(seen.name, stopWord(seen))} when Tab reached it.`,
      fact: `${persona} ${verb} ${quoted} by pressing Tab. Press ${seen.press} reached ${named(seen.name, stopWord(seen))}, which matches it. ` +
        `It was more than ${radiusPx} px from the middle of the screen and from the stop before it, outside the area ${persona} can make out.${place}`,
      forTeam: 'Keep the focused element away from the edge of the screen when Tab brings it into view, for example with scroll padding.'
    }
  }
  switch (reason) {
    case 'wrapped':
      return {
        headline: `${persona} would not find ${quoted}.`,
        fact: `${persona} ${verb} ${quoted} by pressing Tab. Tab went through ${stopCount(stopsAttempted)} and came back to where it started without reaching it.${last}${place}`,
        forTeam: `Give what leads to ${quoted} a plain name that matches the words people look for, and make sure Tab can reach it.`
      }
    case 'budget-stops':
      return {
        headline: `${persona} would still be looking for ${quoted} after ${stopCount(stopsAttempted)}.`,
        fact: `${persona} ${verb} ${quoted} by pressing Tab. After ${stopCount(stopsAttempted)} it had not been reached, so we stopped there and did not look at the rest.${last}${place}`,
        forTeam: `Bring the way to ${quoted} closer to the start of the page, or add a link at the start that jumps to it.`
      }
    case 'trapped':
      return {
        headline: `${persona} would find Tab going round the same places while looking for ${quoted}.`,
        fact: `${persona} ${verb} ${quoted} by pressing Tab. Tab went round the same places in the same order, so the rest of the page could not be reached.${last}${place}`,
        forTeam: 'Let Tab move past this group so the rest of the page can be reached.'
      }
    case 'nothing-focusable':
      return {
        headline: `${persona} would find nothing to reach with Tab while looking for ${quoted}.`,
        fact: `${persona} ${verb} ${quoted} by pressing Tab. Pressing Tab did not move focus to anything on the page.${place}`,
        forTeam: 'Make the links and buttons on the page reachable with Tab.'
      }
    default:
      return null
  }
}
