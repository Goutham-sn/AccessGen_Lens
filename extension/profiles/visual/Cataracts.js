import { BaseProfile } from '../BaseProfile.js'
import { setPageFilter, clearPageFilter } from '../pageFilter.js'

// A clouded lens: everything hazy and low in contrast, colours yellowed,
// and a milky glare over the screen that washes out pale text.
const FILTERS = {
  1: 'blur(1px) contrast(0.82) brightness(1.04) sepia(0.25)',
  2: 'blur(2px) contrast(0.68) brightness(1.08) sepia(0.4)',
  3: 'blur(3.5px) contrast(0.52) brightness(1.12) sepia(0.55)'
}
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
    clearPageFilter(this)
    super.destroy()
  }
}
