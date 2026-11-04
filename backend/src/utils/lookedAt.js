import { liveChecksFor } from '../config/runnerCapabilities.js'
import {
  CHECK_WORDS, zeroMomentsLine, recordedOnlyLine, nothingMeasuredLine, EXTENSION_NO_MOMENTS, UNVERIFIED_LABEL,
  taskLookedAt, taskAllReachedLine
} from '../config/copy.js'

// What a runner session looked at and could not look at, for the run page
// and the reports. null for sessions the runner did not make.
//   items        one line per live check for the session's conditions,
//                taken from the live-check list only. A task run (coverage.task)
//                has one line about the list instead: no checks ran
//   noItems      shown instead of the list when there is no live check
//   unverified   null, or { label, items, moments } when the run included
//                checks that are not live yet (dev-only unverified mode):
//                the label to show, what they look at, and how many moments
//                came from them. Never mixed into `items`
//   gaps         coverage lines from the run ("Focus entered a frame ...")
//   zeroMoments  the line shown instead of a moments list when there are
//                none, or null. Never given for a run that stopped early or
//                whose walk ran out of time: that is not a normal result.
export function lookedAt(session, momentCount) {
  if (session?.source !== 'runner') return null
  const name = session.persona_snapshot?.name || 'this person'
  const coverage = session.coverage || {}
  const task = coverage.task || null
  const items = task
    ? [taskLookedAt(name, task.intents)]
    : liveChecksFor((session.active_profiles || []).map((p) => p.id)).map((id) => CHECK_WORDS[id]).filter(Boolean)
  const unverifiedItems = (Array.isArray(coverage.unverifiedChecks) ? coverage.unverifiedChecks : [])
    .map((id) => CHECK_WORDS[id]).filter(Boolean)
  const walked = coverage.presses != null
  const normalEnd = session.processing_complete && !coverage.stoppedReason && !coverage.walkIncomplete

  let zeroMoments = null
  if (momentCount === 0 && normalEnd) {
    zeroMoments = task
      ? (task.reached === task.intents ? taskAllReachedLine(name, task.intents) : null)
      : walked
      ? zeroMomentsLine({ presses: coverage.presses, things: items.length + unverifiedItems.length })
      : recordedOnlyLine(name)
  }
  return {
    items,
    noItems: items.length === 0 ? nothingMeasuredLine(name) : null,
    unverified: unverifiedItems.length
      ? { label: UNVERIFIED_LABEL, items: unverifiedItems, moments: coverage.unverifiedMoments ?? 0 }
      : null,
    gaps: Array.isArray(coverage.notes) ? coverage.notes : [],
    zeroMoments
  }
}

// What a report says where the moments would be, when there are none.
export function noMomentsText(session, momentCount) {
  if (momentCount > 0) return null
  // A run that stopped early says why, never "nothing noticed".
  if (session?.source === 'runner') return lookedAt(session, momentCount)?.zeroMoments ?? session.coverage?.stoppedReason ?? null
  return EXTENSION_NO_MOMENTS
}
