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
  const did = presses != null
    ? `We pressed Tab ${presses} time${presses === 1 ? '' : 's'}`
    : 'We looked at the page'
  const only = things === 1 ? 'We only look at this one thing.' : `We only look at these ${things} things.`
  return `${did} and noticed nothing that matches what we look for here. ${only}`
}
