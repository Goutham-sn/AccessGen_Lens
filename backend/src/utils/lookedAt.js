import { RUNNER_CAPABILITIES } from '../config/runnerCapabilities.js'
import { CHECK_WORDS, zeroMomentsLine } from '../config/copy.js'

// What a runner session looked at and could not look at, for the run page
// and the reports. null for sessions the runner did not make.
//   items        the live checks for the session's conditions, in words
//   gaps         coverage lines from the run ("Focus entered a frame ...")
//   zeroMoments  the line shown instead of a moments list when there are
//                none, or null
export function lookedAt(session, momentCount) {
  if (session?.source !== 'runner') return null
  const ids = []
  for (const p of session.active_profiles || []) {
    for (const [id, live] of Object.entries(RUNNER_CAPABILITIES[p.id]?.checks || {})) {
      if (live && !ids.includes(id)) ids.push(id)
    }
  }
  const items = ids.map((id) => CHECK_WORDS[id]).filter(Boolean)
  const coverage = session.coverage || {}
  return {
    items,
    gaps: Array.isArray(coverage.notes) ? coverage.notes : [],
    zeroMoments: momentCount === 0 && session.processing_complete
      ? zeroMomentsLine({ presses: coverage.presses ?? null, things: items.length })
      : null
  }
}
