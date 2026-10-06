// Shared copy. The intro appears on the /start page (served through
// GET /api/runs/capabilities), in the web report, the shared report and the
// PDF, always from this one constant.
export const SIMULATION_INTRO =
  'This is a simulation, not a test. Nothing is marked right or wrong. ' +
  'We open the page the way a person would use it and show you what happens. ' +
  'What to change is up to you and your team.'

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
