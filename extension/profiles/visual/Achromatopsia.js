import { BaseProfile } from '../BaseProfile.js'
import { setPageFilter, clearPageFilter } from '../pageFilter.js'

export class Achromatopsia extends BaseProfile {
  init() {
    // Severity 1 and 2: colours faded rather than gone. Complete
    // achromatopsia also brings strong light sensitivity and low acuity:
    // bright pages glare and fine detail softens.
    const f = { 1: 'grayscale(60%)', 2: 'grayscale(85%) brightness(1.04)', 3: 'grayscale(100%) brightness(1.12) contrast(0.88) blur(0.8px)' }
    setPageFilter(this, f[this.severity] || f[3])
  }

  update(severity) {
    super.update(severity)
    this.init()
  }

  destroy() {
    clearPageFilter(this)
    super.destroy()
  }
}
