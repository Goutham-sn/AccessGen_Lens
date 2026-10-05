import { RUNNER_CAPABILITIES, liveChecks } from '../../../backend/src/config/runnerCapabilities.js'
import { WALK_PROFILES } from '../walkProfiles.js'
import { FILTER_PROFILE_IDS } from '../inject/profilesEntry.js'
import tabWalk from './tabWalk.js'
import filterVideo from './filterVideo.js'
import focusVisible from './focusVisible.js'
import longWay from './longWay.js'
import focusLost from './focusLost.js'
import focusHidden from './focusHidden.js'
import trap from './trap.js'

// The keyboard detectors, in the order they run at each stop. Trap is last
// because it ends the measure pass with one press of Escape.
export const KEYBOARD_CHECKS = [focusVisible, longWay, focusLost, focusHidden, trap]

// Every check the runner can run, by the id used in
// backend/src/config/runnerCapabilities.js. Later phases register their
// detectors here. A check marked live there must have a module here.
export const CHECKS = {
  [tabWalk.id]: tabWalk,
  [filterVideo.id]: filterVideo,
  ...Object.fromEntries(KEYBOARD_CHECKS.map((c) => [c.id, c]))
}

// What is wrong with the runner against the capabilities file, in plain
// words. Empty when everything lines up.
export function capabilityGaps() {
  const gaps = []
  for (const id of liveChecks()) {
    if (!CHECKS[id]) gaps.push(`check "${id}" is marked live but has no module in src/checks`)
  }
  const implemented = new Set([...WALK_PROFILES, ...FILTER_PROFILE_IDS])
  for (const profile of Object.keys(RUNNER_CAPABILITIES)) {
    if (!implemented.has(profile)) gaps.push(`profile "${profile}" is listed but the runner has no way to simulate it`)
  }
  return gaps
}

// The detectors a persona runs: registered modules that measure something,
// whose check is live for at least one of the persona's profiles.
export function detectorsFor(profileIds) {
  return Object.values(CHECKS).filter((c) =>
    (c.onStop || c.measure) &&
    profileIds.some((p) => RUNNER_CAPABILITIES[p]?.checks?.[c.id] === true))
}
