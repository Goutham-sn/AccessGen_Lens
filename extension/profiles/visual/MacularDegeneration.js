import { BaseProfile } from '../BaseProfile.js'

// Macular degeneration takes the centre of vision, exactly where you look.
// People do not see a black hole: the brain fills it in, so the centre is a
// grey, blurred, washed-out smudge where letters and faces dissolve, with a
// soft irregular edge. The edges of vision stay clear, so people learn to
// look slightly to one side. The smudge follows the gaze (the pointer or
// keyboard focus) with the eye's small lag.
const SPOT = {
  1: { size: 0.09, blur: 6, haze: 0.18 },
  2: { size: 0.15, blur: 10, haze: 0.32 },
  3: { size: 0.23, blur: 14, haze: 0.5 }
}

export class MacularDegeneration extends BaseProfile {
  init() {
    this.x = window.innerWidth / 2
    this.y = window.innerHeight / 2
    this.gx = this.x
    this.gy = this.y
    this.t0 = performance.now()

    this.spot = document.createElement('div')
    this.spot.setAttribute('aria-hidden', 'true')
    this.spot.dataset.accessgen = 'true'
    this.spot.style.cssText = 'position: fixed; left: 0; top: 0; pointer-events: none; z-index: 2147483641; will-change: transform;'
    this.addElement(this.spot)
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

    const loop = (now) => {
      this.gx += (this.x - this.gx) * 0.25
      this.gy += (this.y - this.gy) * 0.25
      // The edge shifts very slightly, as fixation never holds still.
      const wob = Math.sin((now - this.t0) / 900) * 0.04
      this.spot.style.transform = `translate(${this.gx - this.w / 2}px, ${this.gy - this.h / 2}px) rotate(${wob * 40}deg)`
      this.rafs[0] = requestAnimationFrame(loop)
    }
    this.rafs.push(requestAnimationFrame(loop))
  }

  style() {
    const s = SPOT[this.severity] || SPOT[2]
    const r = Math.min(window.innerWidth, window.innerHeight) * s.size
    this.w = r * 2.8
    this.h = r * 2.3
    Object.assign(this.spot.style, {
      width: `${this.w}px`,
      height: `${this.h}px`,
      background: `rgba(128, 126, 122, ${s.haze})`,
      backdropFilter: `blur(${s.blur}px) contrast(0.45) saturate(0.3) brightness(1.04)`,
      webkitBackdropFilter: `blur(${s.blur}px) contrast(0.45) saturate(0.3) brightness(1.04)`,
      // Irregular: two overlapping soft shapes, not a circle.
      maskImage: 'radial-gradient(ellipse 50% 50% at 46% 52%, #000 0, #000 42%, rgba(0,0,0,.7) 58%, transparent 74%), radial-gradient(ellipse 38% 34% at 60% 40%, #000 0, rgba(0,0,0,.6) 50%, transparent 72%)',
      webkitMaskImage: 'radial-gradient(ellipse 50% 50% at 46% 52%, #000 0, #000 42%, rgba(0,0,0,.7) 58%, transparent 74%), radial-gradient(ellipse 38% 34% at 60% 40%, #000 0, rgba(0,0,0,.6) 50%, transparent 72%)',
      borderRadius: '45% 55% 50% 50% / 52% 48% 55% 45%'
    })
  }

  update(severity) {
    super.update(severity)
    this.style()
  }
}
