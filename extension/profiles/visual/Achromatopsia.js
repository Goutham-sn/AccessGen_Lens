import { BaseProfile } from '../BaseProfile.js'

export class Achromatopsia extends BaseProfile {
  init() {
    this.previousFilter = document.documentElement.style.filter
    document.documentElement.style.filter =
      `${this.previousFilter ? this.previousFilter + ' ' : ''}grayscale(100%)`
  }

  destroy() {
    document.documentElement.style.filter = this.previousFilter || ''
    super.destroy()
  }
}
