import { BaseProfile } from '../BaseProfile.js'

const FILTERS = {
  1: 'blur(2px) brightness(0.9)',
  2: 'blur(4px) brightness(0.8)',
  3: 'blur(8px) brightness(0.7) contrast(0.8)'
}

export class LowVision extends BaseProfile {
  init() {
    this.previousFilter = document.documentElement.style.filter
    this.apply()
  }

  apply() {
    const base = this.previousFilter ? this.previousFilter + ' ' : ''
    document.documentElement.style.filter = base + FILTERS[this.severity]
  }

  update(severity) {
    super.update(severity)
    this.apply()
  }

  destroy() {
    document.documentElement.style.filter = this.previousFilter || ''
    super.destroy()
  }
}
