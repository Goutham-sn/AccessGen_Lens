import { BaseProfile } from '../../../extension/profiles/BaseProfile.js'
import { stick } from '../measuringStick.js'

// Tunnel vision as the task walk judges it (scoreStop in task.js), so the
// video shows exactly what the finding says: the page is dark except within
// tunnelRadiusPx of the middle of the screen and of the place the person was
// just at (the anchor). The extension's own version follows the mouse and
// shrinks with severity; neither applies here, because the walk has no mouse
// and the judgement uses one fixed distance.
//
// The anchor is kept in page coordinates, so it stays on the same place of the
// page when Tab scrolls. The walk moves it as each Tab is pressed.
//
// This number is bundled in when dist/profiles.js is built (see
// scripts/build-profiles.js); change it in measuringStick.js and rebuild.
const RADIUS = stick('task', 'tunnelRadiusPx')
const EDGE = 0.1 // the edge fades from 0.9 to 1.1 times the radius, not a hard line
const DARK = 'rgba(0, 0, 0, 0.96)'

export class RunnerTunnelVision extends BaseProfile {
  init() {
    this.canvas = this.makeOverlayCanvas(2147483641)
    this.ctx = this.canvas.getContext('2d')
    this.anchor = null
    const loop = () => {
      this.redraw()
      this.rafs[0] = requestAnimationFrame(loop)
    }
    this.rafs.push(requestAnimationFrame(loop))
  }

  // { x, y } in page coordinates, or null for no anchor (a new page).
  setAnchor(point) {
    this.anchor = point
  }

  redraw() {
    const { ctx, canvas } = this
    const w = canvas.width
    const h = canvas.height
    ctx.globalCompositeOperation = 'source-over'
    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = DARK
    ctx.fillRect(0, 0, w, h)

    // Cut a clear area out of the dark at each place that can be made out.
    ctx.globalCompositeOperation = 'destination-out'
    const places = [{ x: w / 2, y: h / 2 }]
    if (this.anchor) places.push({ x: this.anchor.x - window.scrollX, y: this.anchor.y - window.scrollY })
    for (const p of places) {
      const grad = ctx.createRadialGradient(p.x, p.y, RADIUS * (1 - EDGE), p.x, p.y, RADIUS * (1 + EDGE))
      grad.addColorStop(0, 'rgba(0, 0, 0, 1)')
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, w, h)
    }
    ctx.globalCompositeOperation = 'source-over'
  }
}
