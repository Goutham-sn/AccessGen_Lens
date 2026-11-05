import { BaseProfile } from '../BaseProfile.js'

// Tunnel vision (glaucoma, retinitis pigmentosa, some strokes): people do
// not see black at the edges. The periphery is simply missing detail: it
// blurs, loses colour and contrast and dims, more the further out it is,
// so things there are not noticed at all. Clear vision follows the gaze,
// here the pointer or keyboard focus, which the eyes reach with a little lag.
const CLEAR_RADIUS = { 1: 0.4, 2: 0.25, 3: 0.15 } // share of the viewport's shorter side
const EDGE = {
  1: { blur: 4, dim: 0.35, desat: 0.5 },
  2: { blur: 7, dim: 0.6, desat: 0.8 },
  3: { blur: 10, dim: 0.82, desat: 1 }
}

export class TunnelVision extends BaseProfile {
  init() {
    this.x = window.innerWidth / 2
    this.y = window.innerHeight / 2
    this.gx = this.x
    this.gy = this.y

    // Rings of increasing blur, desaturation and dimming, each with a hole
    // for clear sight cut out (clip-path, which Chrome renders reliably with
    // backdrop-filter; a mask does not). Stacked, they make the soft,
    // gradual loss toward the edge.
    this.layers = [0.7, 0.9, 1.1, 1.3, 1.55, 1.85].map((holeScale, i) => {
      const el = document.createElement('div')
      el.setAttribute('aria-hidden', 'true')
      el.dataset.accessgen = 'true'
      el.style.cssText = 'position: fixed; inset: 0; pointer-events: none; z-index: 2147483641;'
      this.addElement(el)
      return { el, holeScale, i }
    })
    // The dimming: one smooth gradient, so no bands.
    this.dim = document.createElement('div')
    this.dim.setAttribute('aria-hidden', 'true')
    this.dim.dataset.accessgen = 'true'
    this.dim.style.cssText = 'position: fixed; inset: 0; pointer-events: none; z-index: 2147483641;'
    this.addElement(this.dim)
    this.style()

    this.addListener(window, 'mousemove', (e) => { this.x = e.clientX; this.y = e.clientY }, { capture: true, passive: true })
    this.addListener(document, 'focusin', (e) => {
      const el = e.target
      if (!el?.getBoundingClientRect || el.closest?.('[data-accessgen]')) return
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) return
        this.x = r.left + r.width / 2
        this.y = r.top + r.height / 2
      })
    }, { capture: true })

    const loop = () => {
      this.gx += (this.x - this.gx) * 0.22
      this.gy += (this.y - this.gy) * 0.22
      this.place()
      this.rafs[0] = requestAnimationFrame(loop)
    }
    this.rafs.push(requestAnimationFrame(loop))
  }

  style() {
    const e = EDGE[this.severity] || EDGE[2]
    for (const { el, i } of this.layers) {
      const k = (i + 1) / this.layers.length
      const f = `blur(${(e.blur * k * 0.6).toFixed(1)}px) grayscale(${(e.desat * k).toFixed(2)})`
      el.style.backdropFilter = f
      el.style.webkitBackdropFilter = f
    }
  }

  place() {
    const W = window.innerWidth
    const H = window.innerHeight
    const r = Math.min(W, H) * (CLEAR_RADIUS[this.severity] || 0.25)
    for (const { el, holeScale } of this.layers) {
      const rx = r * holeScale * 1.15
      const ry = r * holeScale
      const x = this.gx
      const y = this.gy
      // The whole screen, minus an ellipse at the gaze (even-odd).
      el.style.clipPath = `path(evenodd, "M0 0H${W}V${H}H0Z M${x - rx} ${y}a${rx} ${ry} 0 1 0 ${rx * 2} 0a${rx} ${ry} 0 1 0 ${-rx * 2} 0Z")`
    }
    const e = EDGE[this.severity] || EDGE[2]
    this.dim.style.background = `radial-gradient(ellipse ${r * 1.15}px ${r}px at ${this.gx}px ${this.gy}px, rgba(22,22,24,0) 0, rgba(22,22,24,0) ${r * 0.8}px, rgba(22,22,24,${(e.dim * 0.55).toFixed(2)}) ${r * 1.5}px, rgba(22,22,24,${e.dim}) ${r * 2.6}px)`
  }

  update(severity) {
    super.update(severity)
    this.style()
  }
}
