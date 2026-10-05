import { BaseProfile } from '../BaseProfile.js'
import { setPageFilter, clearPageFilter } from '../pageFilter.js'

const FILTERS = {
  1: 'blur(2px) brightness(0.9)',
  2: 'blur(4px) brightness(0.8)',
  3: 'blur(8px) brightness(0.7) contrast(0.8)'
}

export class LowVision extends BaseProfile {
  init() {
    this.apply()
  }

  apply() {
    setPageFilter(this, FILTERS[this.severity])
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
