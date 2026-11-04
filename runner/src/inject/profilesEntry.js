// Bundled by scripts/build-profiles.js into dist/profiles.js and evaluated
// in the recorded pass only. These are the extension's own profile classes,
// so the video shows the same simulation the extension does.
//
// keyboard-only is deliberately absent: the extension's version forces a
// focus ring on every element and draws a focus-order overlay, which would
// hide exactly what the keyboard walk is there to show.
import { Deuteranopia } from '../../../extension/profiles/visual/Deuteranopia.js'
import { Achromatopsia } from '../../../extension/profiles/visual/Achromatopsia.js'
import { LowVision } from '../../../extension/profiles/visual/LowVision.js'
import { RunnerTunnelVision } from './tunnelVision.js'

const REGISTRY = {
  deuteranopia: Deuteranopia,
  achromatopsia: Achromatopsia,
  'low-vision': LowVision
}

// Read by src/checks/index.js to confirm every filter profile the backend
// lists has an implementation here.
export const FILTER_PROFILE_IDS = Object.keys(REGISTRY)

// Conditions drawn on a canvas over the page instead of a filter on it. Kept
// apart from the filters: a filter on <html> and a canvas behave differently
// (see evidence.test.js), and the walk moves a canvas's anchor (anchor below).
const OVERLAYS = { 'tunnel-vision': RunnerTunnelVision }
export const OVERLAY_PROFILE_IDS = Object.keys(OVERLAYS)

const active = []

globalThis[Symbol.for('accessgen.runner.profiles')] = {
  apply(profiles) {
    for (const { id, severity } of profiles || []) {
      const Profile = REGISTRY[id] || OVERLAYS[id]
      if (!Profile) continue
      const p = new Profile(severity ?? 2)
      p.init()
      active.push(p)
    }
    return active.length
  },
  // Tells the conditions that follow the person where they were just at, in
  // page coordinates (null on a new page).
  anchor(point) {
    for (const p of active) p.setAnchor?.(point)
  },
  destroy() {
    while (active.length) active.pop().destroy()
  }
}
