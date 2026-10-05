import panelCss from './ControlPanel.css?inline'
import { EmpathyButtonView } from './EmpathyButton.js'

const KEYBOARD_HINTS = {
  'keyboard-only': 'Tab / Shift+Tab to move · Enter to activate',
  'switch-access': 'Space activates the highlighted element',
  'screen-reader': 'Tab to hear each element announced'
}

// The in-page control panel, fully isolated inside Shadow DOM.
export class AccessGenControlPanel extends HTMLElement {
  constructor() {
    super()
    this.attachShadow({ mode: 'open' })
    this.dataset.accessgenPanel = 'true'
    this.dataset.accessgen = 'true'
  }

  connectedCallback() {
    if (!this.shadowRoot) return

    this.shadowRoot.innerHTML = `
      <style>${panelCss}</style>
      <div class="panel" data-accessgen-panel="true">
        <div class="header" part="header">
          <span class="logo">AccessGen Lens</span>
          <span class="recording-dot" title="Recording"></span>
          <button class="close-btn" type="button" aria-label="Hide panel">✕</button>
        </div>
        <div class="active-profiles"></div>
        <button class="empathy-btn" type="button">◉ I Felt This</button>
        <div class="empathy-menu"></div>
        <div class="toast"></div>
        <button class="stop-btn" type="button">■ Stop Simulation</button>
        <div class="keyboard-hints"></div>
      </div>
    `

    this.empathy = new EmpathyButtonView(this.shadowRoot, (label) => {
      this.dispatchEvent(new CustomEvent('empathy-moment', { detail: { label } }))
      this.empathy.confirm(label)
    })

    const closeButton = this.shadowRoot.querySelector('.close-btn')
    const panel = this.shadowRoot.querySelector('.panel')
    if (closeButton && panel) {
      closeButton.addEventListener('click', () => {
        panel.style.display = 'none'
      })
    }

    const stopButton = this.shadowRoot.querySelector('.stop-btn')
    stopButton?.addEventListener('click', () => {
      // This is the whole point of putting the button here: without it,
      // ending a session meant leaving the simulated page and going back
      // to the AccessGen Lens tab. This dispatches to simulation-controller.js,
      // which asks the background worker to end the session, flush the
      // last frames, close this tab, and hand the finished recording back
      // to the web app — all without the user leaving this page.
      this.setStopping(true)
      this.dispatchEvent(new CustomEvent('stop-simulation'))
    })

    this.makeDraggable()
    this.restorePosition()
  }

  setStopping(isStopping) {
    const btn = this.shadowRoot?.querySelector('.stop-btn')
    if (!btn) return
    btn.disabled = isStopping
    btn.textContent = isStopping ? 'Ending session…' : '■ Stop Simulation'
  }

  setProfiles(profiles) {
    const container = this.shadowRoot?.querySelector('.active-profiles')
    if (!container) return

    container.innerHTML = ''
    for (const p of profiles) {
      const chip = document.createElement('span')
      chip.className = 'chip'
      chip.textContent = p.name || p.id
      container.appendChild(chip)
    }
    const hints = profiles
      .map((p) => KEYBOARD_HINTS[p.id])
      .filter(Boolean)
    const hintsBox = this.shadowRoot?.querySelector('.keyboard-hints')
    if (hintsBox) {
      hintsBox.textContent = hints.join(' · ') || 'Browse naturally — everything is being recorded.'
    }
  }

  setRecording(on) {
    this.shadowRoot?.querySelector('.recording-dot')?.classList.toggle('off', !on)
  }

  makeDraggable() {
    const header = this.shadowRoot?.querySelector('.header')
    if (!header) return
    let startX, startY, origRight, origBottom, dragging = false

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('.close-btn')) return
      dragging = true
      startX = e.clientX
      startY = e.clientY
      const rect = this.getBoundingClientRect()
      origRight = window.innerWidth - rect.right
      origBottom = window.innerHeight - rect.bottom
      e.preventDefault()
      e.stopPropagation()
    })

    window.addEventListener('mousemove', (e) => {
      if (!dragging) return
      const right = Math.max(0, origRight - (e.clientX - startX))
      const bottom = Math.max(0, origBottom - (e.clientY - startY))
      this.style.right = `${right}px`
      this.style.bottom = `${bottom}px`
    }, true)

    window.addEventListener('mouseup', () => {
      if (!dragging) return
      dragging = false
      try {
        chrome.storage.local.set({
          panelPosition: { right: this.style.right, bottom: this.style.bottom }
        })
      } catch { /* extension context gone */ }
    }, true)
  }

  async restorePosition() {
    try {
      const { panelPosition } = await chrome.storage.local.get('panelPosition')
      if (panelPosition) {
        this.style.right = panelPosition.right
        this.style.bottom = panelPosition.bottom
      }
    } catch { /* defaults are fine */ }
  }
}

export function mountControlPanel() {
  if (typeof document === 'undefined') return null

  const registry = globalThis.customElements || document.defaultView?.customElements
  if (!registry) return null

  if (!registry.get('accessgen-control-panel')) {
    registry.define('accessgen-control-panel', AccessGenControlPanel)
  }
  let panel = document.querySelector('accessgen-control-panel')
  if (!panel) {
    panel = document.createElement('accessgen-control-panel')
    document.documentElement.appendChild(panel)
  }
  return panel
}
