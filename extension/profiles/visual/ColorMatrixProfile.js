import { BaseProfile } from '../BaseProfile.js'
import { setPageFilter, clearPageFilter } from '../pageFilter.js'

// Shared implementation for the dichromacy simulations: injects an SVG
// feColorMatrix filter and applies it to the whole document.
export class ColorMatrixProfile extends BaseProfile {
  constructor(severity, filterId, matrix) {
    super(severity)
    this.filterId = filterId
    this.matrix = matrix
  }

  // Severity 1 and 2 are anomalous trichromacy (colours weakened, not
  // gone): the full dichromat matrix mixed with the identity.
  static STRENGTH = { 1: 0.45, 2: 0.75, 3: 1 }

  values() {
    const k = ColorMatrixProfile.STRENGTH[this.severity] ?? 1
    const identity = [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0]
    return this.matrix.map((v, i) => +(identity[i] * (1 - k) + v * k).toFixed(4)).join(' ')
  }

  update(severity) {
    super.update(severity)
    this.svg?.querySelector('feColorMatrix')?.setAttribute('values', this.values())
  }

  init() {
    const svgNS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('style', 'position:absolute;width:0;height:0')
    svg.setAttribute('aria-hidden', 'true')
    svg.innerHTML = `
      <defs>
        <filter id="${this.filterId}">
          <feColorMatrix type="matrix" values="${this.values()}" />
        </filter>
      </defs>`
    this.svg = this.addElement(svg, document.documentElement)

    setPageFilter(this, `url(#${this.filterId})`)
  }

  destroy() {
    clearPageFilter(this)
    super.destroy()
  }
}
