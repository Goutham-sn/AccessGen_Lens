import { BaseProfile } from '../BaseProfile.js'
import { setPageFilter, clearPageFilter } from '../pageFilter.js'
import { startContrastLoss } from './contrastLoss.js'

// A clouded lens: everything hazy and low in contrast, colours yellowed,
// and a milky glare over the screen that washes out pale text.
// A clouded lens scatters light (haze and glare), yellows colours and
// lowers contrast sensitivity a lot; acuity drops less than people think.
const FILTERS = {
  1: 'blur(0.6px) contrast(0.84) brightness(1.04) sepia(0.22)',
  2: 'blur(1.1px) contrast(0.72) brightness(1.08) sepia(0.36)',
  3: 'blur(1.8px) contrast(0.58) brightness(1.12) sepia(0.5)'
}
const CONTRAST = { 1: [4, 0.5], 2: [6, 0.72], 3: [8, 0.85] }
const GLARE = { 1: 0.14, 2: 0.24, 3: 0.36 }

export class Cataracts extends BaseProfile {
  init() {
    this.glare = document.createElement('div')
    this.glare.setAttribute('aria-hidden', 'true')
    this.glare.dataset.accessgen = 'true'
    this.addElement(this.glare)
    this.apply()
  }

  apply() {
    setPageFilter(this, FILTERS[this.severity])
    this.stopContrast?.()
    const [threshold, maxFade] = CONTRAST[this.severity] || CONTRAST[2]
    this.stopContrast = startContrastLoss({ threshold, maxFade })
    const a = GLARE[this.severity]
    this.glare.style.cssText = `
      position: fixed; inset: 0; pointer-events: none; z-index: 2147483635;
      background: radial-gradient(ellipse at 50% 40%, rgba(255,255,250,${a}) 0%, rgba(255,255,245,${a * 0.6}) 55%, rgba(255,255,240,${a * 0.35}) 100%);
      mix-blend-mode: screen;
    `
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
