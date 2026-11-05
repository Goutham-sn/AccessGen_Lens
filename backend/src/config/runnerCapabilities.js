// The one list of what "Watch it happen" (the runner) can simulate, and which
// of its checks are running today. Read by:
//   - backend/src/controllers/runs.controller.js (which personas can run)
//   - GET /api/runs/capabilities, which the /start page uses to decide what
//     each card may say it looks at
//   - the runner, which refuses to start if a live check has no module, and
//     its capabilities test, which runs every live check on its fixture
//
// Plain data with no imports, so the runner image can copy this one file.
// A check is set to true only when the runner phase that builds it ships.
export const RUNNER_CAPABILITIES = {
  'keyboard-only': {
    checks: {
      'tab-walk': true,
      'focus-visible': true,
      'long-way': true,
      'focus-lost': true,
      'focus-hidden': true,
      trap: true,
      'page-audit': true
    }
  },
  'screen-reader': {
    checks: {
      // The screen reader findings come from the page audit (axe-core):
      // unnamed controls and fields, pictures with no description, page
      // structure. The tab walk gives what is heard at each stop.
      'tab-walk': true,
      'page-audit': true
    }
  },
  'low-vision': {
    checks: {
      'filter-video': true,
      'page-audit': true
    }
  },
  deuteranopia: {
    checks: { 'filter-video': true, 'page-audit': true }
  },
  achromatopsia: {
    checks: { 'filter-video': true, 'page-audit': true }
  }
}

export const RUNNER_PROFILES = new Set(Object.keys(RUNNER_CAPABILITIES))

// Every check id, and whether it is live for at least one profile.
export function liveChecks() {
  const live = new Set()
  for (const { checks } of Object.values(RUNNER_CAPABILITIES)) {
    for (const [id, on] of Object.entries(checks)) if (on) live.add(id)
  }
  return live
}

export function allChecks() {
  const all = new Set()
  for (const { checks } of Object.values(RUNNER_CAPABILITIES)) {
    for (const id of Object.keys(checks)) all.add(id)
  }
  return all
}

// The live checks for a set of conditions, in the order listed above, each
// once.
export function liveChecksFor(profileIds) {
  const ids = []
  for (const profile of profileIds) {
    for (const [id, live] of Object.entries(RUNNER_CAPABILITIES[profile]?.checks || {})) {
      if (live && !ids.includes(id)) ids.push(id)
    }
  }
  return ids
}

// Each check has a status:
//   live        its flag above is true for some profile: it runs for everyone
//   unverified  built and registered in the runner, with its fixtures
//               passing, but not yet checked by hand against real pages. It
//               runs only in the dev-only unverified mode (below), and its
//               moments are always labelled UNVERIFIED_LABEL
//   null        not built yet
// The flags above stay the one thing that makes a check live; the status is
// derived from them, so nothing can be both. A check moves from unverified
// to live when its flag is set to true, and only then.
// Empty: every built check is live. The keyboard checks were held back
// here, which left most keyboard problems out of every run.
export const BUILT_UNVERIFIED = []

export function checkStatus(id) {
  if (liveChecks().has(id)) return 'live'
  if (BUILT_UNVERIFIED.includes(id)) return 'unverified'
  return null
}

// Dev-only unverified mode: UNVERIFIED_CHECKS=1 and NODE_ENV not production.
// In production the flag is ignored whatever it says.
export function unverifiedEnabled(env = process.env) {
  return env.UNVERIFIED_CHECKS === '1' && env.NODE_ENV !== 'production'
}

// The checks the runner runs for these conditions: the live ones, plus the
// unverified ones listed for them when unverified mode is on.
export function checksToRun(profileIds, env = process.env) {
  const ids = []
  for (const profile of profileIds) {
    for (const [id, live] of Object.entries(RUNNER_CAPABILITIES[profile]?.checks || {})) {
      const run = live || (unverifiedEnabled(env) && checkStatus(id) === 'unverified')
      if (run && !ids.includes(id)) ids.push(id)
    }
  }
  return ids
}

// Task Mode ("find these things in order"). A persona can run it when at
// least one of its profiles is listed here: these are the profiles that decide
// how the page is reached and what can be made out. Other runner profiles
// (the colour filters) still apply on camera next to one of these. Kept apart
// from RUNNER_CAPABILITIES because that list is what regular runs claim, and
// tunnel vision has no checks and no filter in the runner yet.
export const TASK_PROFILES = new Set(['keyboard-only', 'screen-reader', 'tunnel-vision'])

// What a task may ask for. A run has 90 seconds in all and the page is
// walked twice (see persona.js), so a long list cannot finish: six things at
// most, each described in a short phrase.
export const TASK_LIMITS = { goalChars: 200, intents: 6, intentChars: 100 }

// Which of a persona's profiles a run simulates. A regular run takes the
// runner's profiles; a task run also takes the task-only ones, and needs at
// least one of those to say how the page is reached (`ok`).
export function profilesForRun(profiles, isTask) {
  const supported = profiles.filter((p) => RUNNER_PROFILES.has(p.id) || (isTask && TASK_PROFILES.has(p.id)))
  return { supported, ok: isTask ? supported.some((p) => TASK_PROFILES.has(p.id)) : supported.length > 0 }
}

// The pre-check: a quick look at a page before anyone commits to a run (see
// runner/src/precheck.js). Each signal says something to some profiles, and a
// card shows it when any of its profiles is listed. It counts what is on the
// page; it never says whether it is done well.
export const PRECHECK_SIGNALS = {
  // How many places Tab can reach.
  'reachable-stops': ['keyboard-only', 'screen-reader'],
  // How much text there is to read.
  'text-amount': ['low-vision'],
  // How much of the first screen looks different through the red-green filter.
  'colour-change': ['deuteranopia'],
  // How many of those places are out of sight, one after another, with tunnel
  // vision. Only a run with something to find simulates tunnel vision.
  'unseen-stops': ['tunnel-vision']
}
