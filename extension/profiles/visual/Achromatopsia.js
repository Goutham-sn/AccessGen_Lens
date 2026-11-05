import { BaseProfile } from '../BaseProfile.js'
import { setPageFilter, clearPageFilter } from '../pageFilter.js'

export class Achromatopsia extends BaseProfile {
  init() {
    // Severity 1 and 2: colours faded rather than gone.
    setPageFilter(this, `grayscale(${{ 1: 60, 2: 85, 3: 100 }[this.severity] ?? 100}%)`)
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
