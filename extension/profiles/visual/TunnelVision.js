import { BaseProfile } from '../BaseProfile.js'

// Only a small circle of vision remains, following the cursor (gaze proxy).
const CLEAR_RADIUS = { 1: 0.40, 2: 0.25, 3: 0.15 } // fraction of viewport min dimension

export class TunnelVision extends BaseProfile {
  init() {
    this.canvas = this.makeOverlayCanvas(2147483641)
    this.ctx = this.canvas.getContext('2d')
    this.x = window.innerWidth / 2
    this.y = window.innerHeight / 2

    this.addListener(window, 'mousemove', (e) => {
      this.x = e.clientX
      this.y = e.clientY
    }, { capture: true, passive: true })

    // Keyboard users look where focus is, not where a mouse pointer is.
    this.addListener(document, 'focusin', (e) => {
      const el = e.target
      if (!el?.getBoundingClientRect || el.closest?.('[data-accessgen]')) return
      // After the browser has scrolled the element into view.
      requestAnimationFrame(() => {
        const r = el.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) return
        this.x = r.left + r.width / 2
        this.y = r.top + r.height / 2
      })
    }, { capture: true })

    const loop = () => {
      this.redraw()
      this.rafs[0] = requestAnimationFrame(loop)
    }
    this.rafs.push(requestAnimationFrame(loop))
  }

  redraw() {
    const { ctx, canvas } = this
    const w = canvas.width
    const h = canvas.height
    const radius = Math.min(w, h) * CLEAR_RADIUS[this.severity]

    ctx.clearRect(0, 0, w, h)
    // Radial gradient: transparent centre → opaque black edges, with a soft
    // vignette transition band.
    const grad = ctx.createRadialGradient(this.x, this.y, radius * 0.55, this.x, this.y, radius * 1.35)
    grad.addColorStop(0, 'rgba(0,0,0,0)')
    grad.addColorStop(0.6, 'rgba(0,0,0,0.75)')
    grad.addColorStop(1, 'rgba(0,0,0,1)')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
  }

  update(severity) {
    super.update(severity)
  }
}
