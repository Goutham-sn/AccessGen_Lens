import { BaseProfile } from '../BaseProfile.js'

const SPACING = {
  1: { letter: '0.06em', word: '0.12em', line: '1.7' },
  2: { letter: '0.1em', word: '0.2em', line: '1.9' },
  3: { letter: '0.15em', word: '0.3em', line: '2.1' }
}

// OpenDyslexic-style adjustments plus a reading guide band that follows
// the eye down the page.
export class Dyslexia extends BaseProfile {
  init() {
    this.applyTypography()

    // Reading guide: a soft horizontal band tracking the mouse Y.
    this.guide = document.createElement('div')
    this.guide.setAttribute('aria-hidden', 'true')
    this.guide.dataset.accessgen = 'true'
    this.guide.style.cssText = `
      position: fixed; left: 0; right: 0; height: 42px;
      background: rgba(255, 235, 130, 0.22);
      border-top: 1px solid rgba(200, 170, 40, 0.35);
      border-bottom: 1px solid rgba(200, 170, 40, 0.35);
      pointer-events: none; z-index: 2147483638;
      transform: translateY(-50%);
      top: 50%;
    `
    this.addElement(this.guide)

    // Store the latest Y and let a single rAF tick apply it, instead of
    // writing to style on every native mousemove event (which can fire
    // far faster than the display refreshes), the same pattern Tremor and
    // the vision-field profiles use, and why mouse movement felt laggy
    // here specifically while those stayed smooth.
    this.pendingY = null
    this.addListener(window, 'mousemove', (e) => {
      this.pendingY = e.clientY
    }, { passive: true, capture: true })

    const loop = () => {
      if (this.pendingY !== null) {
        this.guide.style.top = `${this.pendingY}px`
        this.pendingY = null
      }
      this.rafs[0] = requestAnimationFrame(loop)
    }
    this.rafs.push(requestAnimationFrame(loop))
  }

  applyTypography() {
    const s = SPACING[this.severity]
    // OpenDyslexic loaded from its CDN-free fallback stack; heavy-bottom
    // letterforms when available, otherwise Comic Sans (closest system match).
    this.styleEl?.remove()
    this.styleEl = this.injectStyle(`
      @font-face {
        font-family: 'OpenDyslexic';
        src: local('OpenDyslexic'), local('OpenDyslexic-Regular');
        font-display: swap;
      }
      body, body * :not([data-accessgen]) {
        font-family: 'OpenDyslexic', 'Comic Sans MS', Verdana, sans-serif !important;
        letter-spacing: ${s.letter} !important;
        word-spacing: ${s.word} !important;
        line-height: ${s.line} !important;
      }
      /* Justified text creates rivers of whitespace: never allow it. */
      [style*="text-align: justify"], [style*="text-align:justify"], p, li, div {
        text-align: left !important;
      }
    `, 'accessgen-dyslexia-css')
    if (!this.elements.includes(this.styleEl)) this.elements.push(this.styleEl)
  }

  update(severity) {
    super.update(severity)
    this.applyTypography()
  }
}
