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

  init() {
    const svgNS = 'http://www.w3.org/2000/svg'
    const svg = document.createElementNS(svgNS, 'svg')
    svg.setAttribute('style', 'position:absolute;width:0;height:0')
    svg.setAttribute('aria-hidden', 'true')
    svg.innerHTML = `
      <defs>
        <filter id="${this.filterId}">
          <feColorMatrix type="matrix" values="${this.matrix.join(' ')}" />
        </filter>
      </defs>`
    this.addElement(svg, document.documentElement)

    setPageFilter(this, `url(#${this.filterId})`)
  }

  destroy() {
    clearPageFilter(this)
    super.destroy()
  }
}
