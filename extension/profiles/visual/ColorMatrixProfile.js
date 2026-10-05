import { BaseProfile } from '../BaseProfile.js'

// Shared implementation for the dichromacy simulations: injects an SVG
// feColorMatrix filter and applies it to the whole document.
export class ColorMatrixProfile extends BaseProfile {
  constructor(severity, filterId, matrix) {
    super(severity)
    this.filterId = filterId
    this.matrix = matrix
    this.previousFilter = null
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

    this.previousFilter = document.documentElement.style.filter
    document.documentElement.style.filter =
      `${this.previousFilter ? this.previousFilter + ' ' : ''}url(#${this.filterId})`
  }

  destroy() {
    document.documentElement.style.filter = this.previousFilter || ''
    super.destroy()
  }
}
