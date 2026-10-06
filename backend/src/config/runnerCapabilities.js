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
      'focus-visible': false,
      'long-way': false,
      'focus-lost': false,
      'focus-hidden': false,
      trap: false
    }
  },
  'screen-reader': {
    checks: {
      'unnamed-controls': false,
      'image-alt': false,
      'unnamed-fields': false,
      structure: false,
      narration: false
    }
  },
  'low-vision': {
    checks: {
      'filter-video': true,
      'reflow-320': false,
      covering: false
    }
  },
  deuteranopia: {
    checks: { 'filter-video': true }
  },
  achromatopsia: {
    checks: { 'filter-video': true }
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
export const BUILT_UNVERIFIED = ['focus-visible', 'long-way', 'focus-lost', 'focus-hidden', 'trap']

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
