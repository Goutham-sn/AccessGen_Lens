// A Manual session's mission: one thing the tester tries to do, as
// themselves first (the baseline session) and then as the person.
//   goal        what to do, in the tester's words (up to 200 characters)
//   outcome     'done' | 'gave-up' | null (ended without saying)
//   durationMs  from the start of the mission to the outcome
export const MISSION_GOAL_MAX = 200

export function cleanGoal(goal) {
  if (typeof goal !== 'string') return null
  const g = goal.replace(/\s+/g, ' ').trim().slice(0, MISSION_GOAL_MAX)
  return g || null
}

export function cleanOutcome(body) {
  const outcome = body?.outcome === 'done' || body?.outcome === 'gave-up' ? body.outcome : null
  const ms = Number(body?.durationMs)
  const durationMs = Number.isFinite(ms) && ms >= 0 && ms < 24 * 3600 * 1000 ? Math.round(ms) : null
  return outcome ? { outcome, durationMs } : null
}

// The mission line of a report: the tester as themselves next to the
// tester as the person. Either side can be missing.
export function missionComparison(session, baseline) {
  const mission = session?.mission
  if (!mission?.goal) return null
  const side = (s) => (s?.mission ? { outcome: s.mission.outcome || null, durationMs: s.mission.durationMs ?? null } : null)
  const as = side(session)
  const you = baseline ? side(baseline) : null
  let ratio = null
  if (as?.outcome === 'done' && you?.outcome === 'done' && you.durationMs > 0 && as.durationMs != null) {
    ratio = Math.round((as.durationMs / you.durationMs) * 10) / 10
  }
  return { goal: mission.goal, you, as, ratio, baselineSessionId: baseline?.id || null }
}
