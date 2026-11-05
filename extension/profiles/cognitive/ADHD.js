import { BaseProfile } from '../BaseProfile.js'
import { setPageFilter, clearPageFilter } from '../pageFilter.js'

// ADHD is not coloured shapes on a screen. It is attention that will not
// stay put:
//   - thoughts that break in, unasked, in the middle of a task;
//   - losing your place: after a while on the same thing, what you were
//     reading slips out of focus until you take hold of it again;
//   - movement on the page (carousels, autoplaying video, animation)
//     pulling the eye far harder than it does for others.
// Severity sets how often it happens and how long it takes to come back.

const THOUGHTS = [
  'Did I answer that message from this morning?',
  'What was I looking for again?',
  'I should check the time.',
  'That song from earlier is still stuck in my head.',
  'Wait, what does the other tab say?',
  'I need to remember to buy milk.',
  'How long have I been on this page?',
  'Is it hot in here, or is it me?',
  'I could just do this later.',
  'What was that noise?'
]
const SETTINGS = {
  1: { thoughtEvery: [40000, 70000], driftAfter: 45000, blur: 1.2 },
  2: { thoughtEvery: [22000, 40000], driftAfter: 28000, blur: 2 },
  3: { thoughtEvery: [12000, 24000], driftAfter: 16000, blur: 3 }
}

export class ADHD extends BaseProfile {
  init() {
    // Motion on the page pulls harder: animation runs faster and brighter.
    this.injectStyle(`
      [class*="carousel"], [class*="slider"], [class*="marquee"], [class*="ticker"], [class*="animate"], marquee, video[autoplay] {
        animation-duration: 0.7s !important;
        filter: saturate(1.35) contrast(1.05);
      }
      .accessgen-thought {
        position: fixed; max-width: 280px; padding: 10px 14px; border-radius: 6px;
        background: #fffdf6; color: #222; border: 1px solid #e3e0d8; box-shadow: 0 4px 18px rgba(0,0,0,.18);
        font: 500 14px/1.35 -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; z-index: 2147483638;
        pointer-events: none; opacity: 0; transform: translateY(6px); transition: opacity .35s ease, transform .35s ease;
      }
      .accessgen-thought.on { opacity: 1; transform: none; }
    `, 'accessgen-adhd-css')

    this.x = window.innerWidth / 2
    this.y = window.innerHeight / 2
    this.lastHold = performance.now()
    const hold = (e) => {
      if (e?.clientX != null) { this.x = e.clientX; this.y = e.clientY }
      this.lastHold = performance.now()
      if (this.drifting) {
        // Getting back on track takes a moment, not an instant.
        clearTimeout(this.backTimer)
        this.backTimer = setTimeout(() => { this.drifting = false; clearPageFilter(this.driftOwner) }, 500 + this.severity * 250)
      }
    }
    this.addListener(window, 'mousemove', hold, { capture: true, passive: true })
    this.addListener(window, 'keydown', hold, { capture: true })
    this.addListener(window, 'wheel', hold, { capture: true, passive: true })
    // Its own owner of the shared page filter, so drifting never undoes a
    // filter another condition set.
    this.driftOwner = {}

    this.scheduleThought()
    // Losing your place: after a stretch of steady attention, it slips.
    this.addInterval(() => {
      const s = SETTINGS[this.severity] || SETTINGS[2]
      if (performance.now() - this.lastHold > 2500 && performance.now() - (this.lastDrift || 0) > s.driftAfter) {
        this.lastDrift = performance.now()
        this.drifting = true
        setPageFilter(this.driftOwner, `blur(${s.blur}px)`)
      }
    }, 1000)
  }

  scheduleThought() {
    const [lo, hi] = (SETTINGS[this.severity] || SETTINGS[2]).thoughtEvery
    this.thoughtTimer = setTimeout(() => {
      this.showThought()
      this.scheduleThought()
    }, lo + Math.random() * (hi - lo))
  }

  showThought() {
    const t = document.createElement('div')
    t.className = 'accessgen-thought'
    t.dataset.accessgen = 'true'
    t.setAttribute('aria-hidden', 'true')
    t.textContent = THOUGHTS[Math.floor(Math.random() * THOUGHTS.length)]
    // Close to where you are working, not politely in a corner.
    const x = Math.min(window.innerWidth - 300, Math.max(12, this.x + 30 - Math.random() * 120))
    const y = Math.min(window.innerHeight - 80, Math.max(12, this.y - 70 + Math.random() * 40))
    t.style.left = `${x}px`
    t.style.top = `${y}px`
    this.addElement(t)
    requestAnimationFrame(() => t.classList.add('on'))
    setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 400) }, 3200 + this.severity * 500)
  }

  update(severity) {
    super.update(severity)
  }

  destroy() {
    clearTimeout(this.thoughtTimer)
    clearTimeout(this.backTimer)
    clearPageFilter(this.driftOwner)
    super.destroy()
  }
}
