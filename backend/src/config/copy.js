// Shared copy. The intro appears on the /start page (served through
// GET /api/runs/capabilities), in the web report, the shared report and the
// PDF, always from this one constant.
export const SIMULATION_INTRO =
  'This is a simulation, not a test. Nothing is marked right or wrong. ' +
  'We open the page the way a person would use it and show you what happens. ' +
  'What to change is up to you and your team.'

// Shown wherever a moment from an unverified check appears: the moment card,
// the run page, the report and the PDF. See runnerCapabilities.js.
export const UNVERIFIED_LABEL = 'Unverified, for testing'

// Reports are a snapshot of one visit. Shown with the run date and time on
// the report, the shared report and the PDF.
export const SNAPSHOT_NOTE = 'The same page can give different results on different days.'

// "Run on 6 October 2026 at 14:32 UTC." For the PDF, which has no viewer
// time zone to use; the web report formats the same instant in the viewer's.
export function ranOnLine(startTime) {
  const d = new Date(startTime)
  if (Number.isNaN(d.getTime())) return ''
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
  return `Run on ${date} at ${time} UTC.`
}

// What each runner check looks at, in plain words. Shown on the run page
// and in the reports under "What we looked at", only for checks that are
// live for the session's conditions (see runnerCapabilities.js).
export const CHECK_WORDS = {
  'tab-walk': 'Where each press of Tab goes, stop by stop',
  'focus-visible': 'Whether there is a visible sign of where Tab went',
  'long-way': 'How many presses of Tab it takes to reach the main content',
  'focus-lost': 'Whether Tab lands on something that can be seen',
  'focus-hidden': 'Whether something covers the place Tab reached',
  trap: 'Whether Tab keeps going round the same places',
  'unnamed-controls': 'Whether controls have names a screen reader can read out',
  'image-alt': 'Whether images have text a screen reader can read out',
  'unnamed-fields': 'Whether form fields have names a screen reader can read out',
  structure: 'The headings and landmarks a screen reader can move between',
  narration: 'What a screen reader says, item by item',
  'filter-video': 'How the page looks with the conditions we can show on screen',
  'tab-skipped': 'Everything that can be clicked but that Tab never reaches',
  'page-audit': 'Every WCAG 2.0, 2.1 and 2.2 rule at levels A and AA, on every element of the page',
  'reflow-320': 'Whether the page fits a narrow screen without scrolling sideways',
  covering: 'Whether something covers the content when the page is zoomed in'
}

// When a run found no moments. Never an all-clear: it says what was done
// and how little we look at.
export function zeroMomentsLine({ presses, things }) {
  const only = things === 1 ? 'We only look at this one thing.' : `We only look at these ${things} things.`
  return `We pressed Tab ${presses} time${presses === 1 ? '' : 's'} and noticed nothing that matches what we look for here. ${only}`
}

// A run with no Tab walk (the person's conditions are only shown on screen).
export const recordedOnlyLine = (name) =>
  `We recorded the page as ${name} would see it. We did not measure anything else in this run.`

// A run whose conditions have no live checks at all.
export const nothingMeasuredLine = (name) =>
  `We do not measure anything for these conditions yet. The video shows the page as ${name} would see it.`

// An extension session (the person explores and marks moments) with none.
export const EXTENSION_NO_MOMENTS =
  'You did not mark any moments in this session. Press I Felt This when something feels wrong.'

// A task run ("find these things in order"): what the report says it looked at,
// and the line shown when nothing went wrong.
export const taskLookedAt = (name, count) =>
  `Whether ${name} can reach ${count === 1 ? 'the thing' : `each of the ${count} things`} on the list, using only Tab and, on a link or button, Enter`

export const taskAllReachedLine = (name, count) =>
  count === 1 ? `${name} reached the thing on the list.` : `${name} reached all ${count} things on the list, in order.`
