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

const REGISTRY = {
  deuteranopia: Deuteranopia,
  achromatopsia: Achromatopsia,
  'low-vision': LowVision
}

const active = []

globalThis[Symbol.for('accessgen.runner.profiles')] = {
  apply(profiles) {
    for (const { id, severity } of profiles || []) {
      const Profile = REGISTRY[id]
      if (!Profile) continue
      const p = new Profile(severity ?? 2)
      p.init()
      active.push(p)
    }
    return active.length
  },
  destroy() {
    while (active.length) active.pop().destroy()
  }
}
