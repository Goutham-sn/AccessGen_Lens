import { BaseProfile } from '../BaseProfile.js'
import { reportFriction, describeElement } from '../../content-scripts/friction.js'

const INTERACTIVE = 'a[href], button, input, select, textarea, summary, label, [role="button"], [role="link"], [role="checkbox"], [role="tab"], [role="menuitem"], [onclick]'

// A Parkinsonian rest tremor, as it moves a real hand on a mouse:
//   - about five oscillations a second, mostly back and forth along one
//     axis that slowly turns (not circles), with a little sideways wobble;
//   - strength that waxes and wanes from moment to moment;
//   - worse when the hand is still (holding over a target to click it),
//     calmer in the middle of a deliberate movement;
//   - the pointer keeps moving between pressing and releasing the button,
//     so a click that starts on a target can end beside it and is lost,
//     and now and then one press is felt twice.
// Pixels of the largest swing for each severity, while still.
const AMPLITUDE = { 1: 3.5, 2: 8, 3: 15 }
const DOUBLE_PRESS = { 1: 0, 2: 0.04, 3: 0.1 }

// Smooth random values between -1 and 1 (one-dimensional value noise).
function noise(seed) {
  const hash = (n) => { const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return (x - Math.floor(x)) * 2 - 1 }
  return (t) => {
    const i = Math.floor(t)
    const f = t - i
    const u = f * f * (3 - 2 * f)
    return hash(i) * (1 - u) + hash(i + 1) * u
  }
}

export class Tremor extends BaseProfile {
  init() {
    this.realX = window.innerWidth / 2
    this.realY = window.innerHeight / 2
    this.shakenX = this.realX
    this.shakenY = this.realY
    this.speed = 0
    this.lastMove = { x: this.realX, y: this.realY, t: performance.now() }
    this.ampNoise = noise(1)
    this.axisNoise = noise(2)
    this.freqNoise = noise(3)
    this.phase = 0
    this.last = performance.now()
    this.downTarget = null

    this.injectStyle(`* { cursor: none !important; }`, 'accessgen-tremor-css')

    this.cursor = document.createElement('div')
    this.cursor.setAttribute('aria-hidden', 'true')
    this.cursor.dataset.accessgen = 'true'
    this.cursor.style.cssText = 'position: fixed; top: 0; left: 0; width: 20px; height: 20px; pointer-events: none; z-index: 2147483645; will-change: transform;'
    this.cursor.innerHTML = `<svg width="20" height="20" viewBox="0 0 20 20"><path d="M2 1 L2 15 L6 11.5 L9 18 L11.5 17 L8.5 10.5 L14 10 Z" fill="black" stroke="white" stroke-width="1.2"/></svg>`
    this.addElement(this.cursor)

    this.addListener(window, 'mousemove', (e) => {
      const now = performance.now()
      const dt = Math.max(1, now - this.lastMove.t)
      const v = Math.hypot(e.clientX - this.lastMove.x, e.clientY - this.lastMove.y) / dt * 1000
      this.speed = this.speed * 0.7 + v * 0.3
      this.lastMove = { x: e.clientX, y: e.clientY, t: now }
      this.realX = e.clientX
      this.realY = e.clientY
    }, { capture: true, passive: true })

    // The press lands where the shaking pointer is at that instant.
    this.addListener(window, 'mousedown', (e) => {
      if (e.target?.dataset?.accessgenPanel || e.accessgenTremor) return
      const el = document.elementFromPoint(this.shakenX, this.shakenY)
      this.downTarget = el?.closest?.(INTERACTIVE) || el
      this.downAimed = e.target?.closest?.(INTERACTIVE) || null
    }, { capture: true })

    this.addListener(window, 'click', (e) => {
      if (e.accessgenTremor) return
      if (e.target?.dataset?.accessgenPanel) return
      if (e.detail === 0) return // a click made by the keyboard: no hand involved
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()

      const aimed = this.downAimed || e.target?.closest?.(INTERACTIVE)
      const upEl = document.elementFromPoint(this.shakenX, this.shakenY)
      const up = upEl?.closest?.(INTERACTIVE) || upEl
      const down = this.downTarget
      this.downTarget = null

      // Released somewhere else than it was pressed: the browser makes no
      // click at all. That is what most "missed" clicks with a tremor are.
      if (down && up && down !== up && !down.contains?.(up) && !up.contains?.(down)) {
        this.noticeMiss(aimed, null, true)
        return
      }
      const target = up
      this.noticeMiss(aimed, target?.closest?.(INTERACTIVE) || null, false)
      if (!target) return
      this.fire(target)
      if (Math.random() < (DOUBLE_PRESS[this.severity] || 0)) {
        setTimeout(() => {
          this.fire(target)
          if (target.closest?.(INTERACTIVE)) {
            reportFriction({
              kind: 'tremor-double', profileId: 'tremor', target,
              headline: `The tremor pressed ${describeElement(target)} twice`,
              detail: 'One press, felt twice. Whatever it does happened two times, with no way to tell.'
            })
          }
        }, 140)
      }
    }, { capture: true })

    const loop = (now) => {
      const dt = Math.min(0.05, (now - this.last) / 1000)
      this.last = now
      const t = now / 1000
      const amp = AMPLITUDE[this.severity] || AMPLITUDE[2]
      // Rest tremor: strongest when the hand is still, eased by movement.
      const rest = 1 / (1 + this.speed / 250)
      this.speed *= 0.92
      const strength = amp * (0.45 + 0.55 * rest) * (0.65 + 0.35 * (this.ampNoise(t * 0.7) + 1) / 2 * 1.4)
      const freq = 4.8 + 0.6 * this.freqNoise(t * 0.3)
      this.phase += 2 * Math.PI * freq * dt
      const axis = Math.PI * 0.35 + this.axisNoise(t * 0.12) * 0.9
      const along = Math.sin(this.phase) * strength
      const across = Math.sin(this.phase * 0.5 + 1.3) * strength * 0.22
      this.shakenX = this.realX + Math.cos(axis) * along - Math.sin(axis) * across
      this.shakenY = this.realY + Math.sin(axis) * along + Math.cos(axis) * across
      this.cursor.style.transform = `translate(${this.shakenX - 2}px, ${this.shakenY - 2}px)`
      this.rafs[0] = requestAnimationFrame(loop)
    }
    this.rafs.push(requestAnimationFrame(loop))
  }

  fire(target) {
    const clone = new MouseEvent('click', {
      bubbles: true, cancelable: true, detail: 1, clientX: this.shakenX, clientY: this.shakenY, view: window
    })
    clone.accessgenTremor = true
    target.dispatchEvent(clone)
  }

  // The click the hand aimed at is not the click the page received.
  noticeMiss(intended, actual, slipped) {
    if (!intended || intended.closest('[data-accessgen]')) return
    if (actual === intended) return
    const r = intended.getBoundingClientRect()
    // WCAG 2.2 AA (2.5.8): at least 24 by 24 pixels.
    const small = r.width < 24 || r.height < 24
    reportFriction({
      kind: slipped ? 'tremor-slipped' : actual ? 'tremor-wrong-target' : 'tremor-missed',
      profileId: 'tremor',
      target: intended,
      headline: slipped
        ? `The pointer slid off ${describeElement(intended)} before the button came up, so the click was lost`
        : actual
        ? `You aimed at ${describeElement(intended)}, the shake clicked ${describeElement(actual)}`
        : `The shake made you miss ${describeElement(intended)}`,
      detail: small
        ? `It is only ${Math.round(r.width)} by ${Math.round(r.height)} pixels: too small to hold a shaking hand on.`
        : 'Things close together leave no room for a hand that shakes.'
    })
  }
}
