import { BaseProfile } from '../BaseProfile.js'
import { setPageFilter, clearPageFilter } from '../pageFilter.js'
import { startContrastLoss } from './contrastLoss.js'

// Low vision, as it is for most people who have it: not a heavy blur over
// everything, but
//   - reduced contrast sensitivity: faint text, pale borders and light
//     placeholders fade into the page, while strong contrast survives
//     (contrastLoss.js, measured element by element);
//   - reduced acuity: a mild blur, which wipes out small text and fine
//     icons while large text stays readable, the way it does for people
//     who lean in or zoom;
//   - at the severe end, veiling glare: light scattered in the eye greys
//     the whole view a little.
const SETTINGS = {
  1: { filter: 'blur(0.7px) contrast(0.93)', threshold: 3.5, maxFade: 0.5 },
  2: { filter: 'blur(1.3px) contrast(0.86)', threshold: 5.5, maxFade: 0.72 },
  3: { filter: 'blur(2.1px) contrast(0.68) brightness(1.08)', threshold: 8, maxFade: 0.86 }
}

export class LowVision extends BaseProfile {
  init() {
    this.apply()
  }

  apply() {
    const s = SETTINGS[this.severity] || SETTINGS[2]
    setPageFilter(this, s.filter)
    this.stopContrast?.()
    this.stopContrast = startContrastLoss({ threshold: s.threshold, maxFade: s.maxFade })
  }

  update(severity) {
    super.update(severity)
    this.apply()
  }

  destroy() {
    this.stopContrast?.()
    this.stopContrast = null
    clearPageFilter(this)
    super.destroy()
  }
}
