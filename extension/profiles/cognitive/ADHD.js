import { BaseProfile } from '../BaseProfile.js'

// Involuntary distraction: peripheral pulses, amplified page animation,
// and periodic "attention drift" where the main content fades away.
export class ADHD extends BaseProfile {
  init() {
    // Phase 1 — amplify any animation already on the page.
    this.injectStyle(`
      *[class*="animate"], *[class*="carousel"], *[class*="slider"], marquee {
        animation-duration: 0.6s !important;
      }
      @keyframes accessgen-adhd-pulse {
        0%, 100% { opacity: 0.25; transform: scale(1); }
        50% { opacity: ${0.4 + this.severity * 0.15}; transform: scale(1.15); }
      }
      .accessgen-distraction {
        position: fixed; width: 60px; height: 60px; border-radius: 50%;
        pointer-events: none; z-index: 2147483637;
        animation: accessgen-adhd-pulse ${4 - this.severity * 0.7}s ease-in-out infinite;
      }
      #accessgen-adhd-dim {
        position: fixed; inset: 0; pointer-events: none;
        background: rgba(245,245,245,0.4); backdrop-filter: blur(0.6px);
        z-index: 2147483636; opacity: 0; transition: opacity 0.8s;
      }
    `, 'accessgen-adhd-css')

    // Phase 2 — peripheral distraction elements at viewport edges.
    const colors = ['#f59e0b', '#3b82f6', '#ec4899', '#22c55e', '#a855f7']
    const positions = [
      { top: '8%', left: '2%' }, { top: '15%', right: '3%' },
      { bottom: '20%', left: '3%' }, { bottom: '10%', right: '2%' },
      { top: '50%', left: '1%' }
    ]
    const count = 2 + this.severity
    this.distractions = []
    for (let i = 0; i < count; i++) {
      const d = document.createElement('div')
      d.className = 'accessgen-distraction'
      d.setAttribute('aria-hidden', 'true')
      d.dataset.accessgen = 'true'
      d.style.background = `radial-gradient(circle, ${colors[i]} 0%, transparent 70%)`
      d.style.animationDelay = `${i * 0.9}s`
      Object.assign(d.style, positions[i])
      this.addElement(d)
      this.distractions.push(d)
    }

    // Phase 3 — attention drift every 15–30 seconds.
    this.dim = document.createElement('div')
    this.dim.id = 'accessgen-adhd-dim'
    this.dim.setAttribute('aria-hidden', 'true')
    this.addElement(this.dim)
    this.scheduleDrift()

    // Phase 4 — autoplaying media dominates.
    document.querySelectorAll('video[autoplay], [class*="banner"] img').forEach((el) => {
      el.style.setProperty('filter', 'saturate(1.6) brightness(1.1)', 'important')
    })
  }

  scheduleDrift() {
    const delay = 15000 + Math.random() * 15000
    this.driftTimer = setTimeout(() => {
      // Drift: main content dims, one peripheral element flares.
      this.dim.style.opacity = '1'
      const flare = this.distractions[Math.floor(Math.random() * this.distractions.length)]
      if (flare) flare.style.animationDuration = '0.5s'
      setTimeout(() => {
        this.dim.style.opacity = '0'
        if (flare) flare.style.animationDuration = ''
      }, 3000)
      this.scheduleDrift()
    }, delay)
  }

  destroy() {
    clearTimeout(this.driftTimer)
    super.destroy()
  }
}
