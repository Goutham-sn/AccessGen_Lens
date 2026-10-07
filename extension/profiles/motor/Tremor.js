import { BaseProfile } from '../BaseProfile.js'

const TREMOR_FREQUENCY_1 = 0.08
const TREMOR_FREQUENCY_2 = 0.13
const AMPLITUDE = { 1: 3, 2: 8, 3: 18 }

// The cursor shakes continuously with layered sine noise, and clicks land
// where the *shaking* cursor is, not where the hand intended.
export class Tremor extends BaseProfile {
  init() {
    this.time = 0
    this.realX = window.innerWidth / 2
    this.realY = window.innerHeight / 2
    this.shakenX = this.realX
    this.shakenY = this.realY

    // Replace the native cursor with a shaking one.
    this.injectStyle(`* { cursor: none !important; }`, 'accessgen-tremor-css')

    this.cursor = document.createElement('div')
    this.cursor.setAttribute('aria-hidden', 'true')
    this.cursor.dataset.accessgen = 'true'
    this.cursor.style.cssText = `
      position: fixed; top: 0; left: 0; width: 20px; height: 20px;
      pointer-events: none; z-index: 2147483645;
      transform: translate(-2px, -2px);
    `
    this.cursor.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 20 20">
        <path d="M2 1 L2 15 L6 11.5 L9 18 L11.5 17 L8.5 10.5 L14 10 Z"
              fill="black" stroke="white" stroke-width="1.2"/>
      </svg>`
    this.addElement(this.cursor)

    this.addListener(window, 'mousemove', (e) => {
      this.realX = e.clientX
      this.realY = e.clientY
    }, { capture: true, passive: true })

    // Re-dispatch clicks at the shaken position: the click you make is the
    // click the tremor gives you.
    this.addListener(window, 'click', (e) => {
      if (e.accessgenTremor) return
      if (e.target?.dataset?.accessgenPanel) return
      const dx = this.shakenX - this.realX
      const dy = this.shakenY - this.realY
      // Only redirect when the shake moved the point meaningfully.
      if (Math.hypot(dx, dy) < 4) return

      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
      const target = document.elementFromPoint(this.shakenX, this.shakenY)
      if (target) {
        const clone = new MouseEvent('click', {
          bubbles: true, cancelable: true,
          clientX: this.shakenX, clientY: this.shakenY, view: window
        })
        clone.accessgenTremor = true
        target.dispatchEvent(clone)
      }
    }, { capture: true })

    // Highlight click targets that are too small (< 44×44) for tremor users.
    this.injectStyle(`
      [data-accessgen-small-target] {
        outline: 2px solid rgba(220, 38, 38, 0.9) !important;
        outline-offset: 1px;
        background-image: linear-gradient(rgba(220,38,38,0.14), rgba(220,38,38,0.14)) !important;
      }
    `, 'accessgen-tremor-targets-css')
    this.markSmallTargets()
    const observer = new MutationObserver(() => this.queueMark())
    this.addObserver(observer, document.body, { childList: true, subtree: true })

    const loop = () => {
      this.time += 1
      const amp = AMPLITUDE[this.severity]
      const noiseX = Math.sin(this.time * TREMOR_FREQUENCY_1 * Math.PI * 2) * amp
        + Math.sin(this.time * TREMOR_FREQUENCY_2 * Math.PI * 2) * (amp * 0.4)
      const noiseY = Math.cos(this.time * TREMOR_FREQUENCY_1 * Math.PI * 2) * amp
        + Math.cos(this.time * TREMOR_FREQUENCY_2 * Math.PI * 2) * (amp * 0.4)
      this.shakenX = this.realX + noiseX
      this.shakenY = this.realY + noiseY
      this.cursor.style.left = `${this.shakenX}px`
      this.cursor.style.top = `${this.shakenY}px`
      this.rafs[0] = requestAnimationFrame(loop)
    }
    this.rafs.push(requestAnimationFrame(loop))
  }

  queueMark() {
    clearTimeout(this.markTimer)
    this.markTimer = setTimeout(() => this.markSmallTargets(), 500)
  }

  markSmallTargets() {
    const targets = document.querySelectorAll(
      'a, button, input, select, textarea, [role="button"], [role="link"], [onclick]'
    )
    for (const el of targets) {
      if (el.dataset.accessgen || el.closest('[data-accessgen]')) continue
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) continue
      if (rect.width < 44 || rect.height < 44) {
        el.setAttribute('data-accessgen-small-target', 'true')
      } else {
        el.removeAttribute('data-accessgen-small-target')
      }
    }
  }

  destroy() {
    clearTimeout(this.markTimer)
    document.querySelectorAll('[data-accessgen-small-target]')
      .forEach((el) => el.removeAttribute('data-accessgen-small-target'))
    super.destroy()
  }
}
