import { BaseProfile } from '../BaseProfile.js'
import { setPageFilter, clearPageFilter } from '../pageFilter.js'

export class Achromatopsia extends BaseProfile {
  init() {
    setPageFilter(this, 'grayscale(100%)')
  }

  destroy() {
    clearPageFilter(this)
    super.destroy()
  }
}
