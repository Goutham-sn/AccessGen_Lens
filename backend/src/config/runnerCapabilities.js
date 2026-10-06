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
