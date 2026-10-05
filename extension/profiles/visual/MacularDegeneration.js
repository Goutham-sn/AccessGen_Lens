import { BaseProfile } from '../BaseProfile.js'

// Inverse of tunnel vision: a soft dark blotch follows the gaze,
// destroying central vision exactly where the user looks.
const BLOTCH = {
  1: { size: 0.08, alpha: 0.55 },
  2: { size: 0.15, alpha: 0.8 },
  3: { size: 0.25, alpha: 0.97 }
}

export class MacularDegeneration extends BaseProfile {
  init() {
    this.canvas = this.makeOverlayCanvas(2147483641)
    this.ctx = this.canvas.getContext('2d')
    this.x = window.innerWidth / 2
    this.y = window.innerHeight / 2

    this.addListener(window, 'mousemove', (e) => {
      this.x = e.clientX
      this.y = e.clientY
    }, { capture: true, passive: true })

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
    const { size, alpha } = BLOTCH[this.severity]
    const r = Math.min(w, h) * size

    ctx.clearRect(0, 0, w, h)
    const grad = ctx.createRadialGradient(this.x, this.y, r * 0.4, this.x, this.y, r * 1.4)
    grad.addColorStop(0, `rgba(15,10,10,${alpha})`)
    grad.addColorStop(0.7, `rgba(15,10,10,${alpha * 0.7})`)
    grad.addColorStop(1, 'rgba(15,10,10,0)')
    ctx.fillStyle = grad

    // Slightly irregular oval — scotomas are rarely perfect circles.
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.scale(1.25, 1)
    ctx.translate(-this.x, -this.y)
    ctx.beginPath()
    ctx.arc(this.x, this.y, r * 1.4, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
}
