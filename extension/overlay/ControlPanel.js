import panelCss from './ControlPanel.css?inline'
import { EmpathyButtonView } from './EmpathyButton.js'
import { styleHost, mountTopLayer, keepOnTop } from './topLayer.js'

export const KEYBOARD_HINTS = {
  'keyboard-only': 'No mouse: Tab and Shift+Tab move, Enter activates.',
  'switch-access': 'One switch: press Space when the highlight reaches what you want.',
  'screen-reader': 'Listen: press Tab and hear each place announced.',
  tremor: 'Your clicks land where the shaking cursor is, not where you aim.',
  'tunnel-vision': 'You can only see around the mouse pointer or keyboard focus.',
  'macular-degeneration': 'The middle of your vision is gone. Look around the edges.',
  dyslexia: 'Letters shift as you read. Try to read a paragraph to the end.',
  adhd: 'Your attention drifts. Try to finish one task anyway.',
  deaf: 'All sound is gone. Notice what you miss.',
  cataracts: 'Everything is hazy and washed out. Look for pale text you can no longer read.',
  protanopia: 'Reds look dark and dull. Notice what was only marked in red.',
  tritanopia: 'Blues and yellows are hard to tell apart.',
  deuteranopia: 'Reds and greens look alike. Notice what was only marked by colour.'
}

function formatElapsed(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// The in-page control panel. Content scripts run in an isolated world where
// window.customElements is null, so this is a plain <div> host with a shadow
// root, not a custom element (the custom element version never mounted).
// It lives in the top layer, so the page filters never blur it.
export class ControlPanel extends EventTarget {
  constructor() {
    super()
    this.host = document.createElement('div')
    this.host.id = 'accessgen-control-panel'
    this.host.dataset.accessgenPanel = 'true'
    this.host.dataset.accessgen = 'true'
    this.host.setAttribute('aria-label', 'AccessGen Lens control panel')
    this.host.setAttribute('role', 'region')
    styleHost(this.host, { right: '20px', bottom: '20px', 'z-index': '2147483647' })

    this.shadow = this.host.attachShadow({ mode: 'open' })
    this.shadow.innerHTML = `
      <style>${panelCss}</style>
      <div class="panel" data-accessgen-panel="true">
        <div class="header" part="header">
          <span class="logo">AccessGen Lens</span>
          <span class="rec" title="Recording"><span class="recording-dot off"></span><span class="elapsed">0:00</span></span>
          <button class="collapse-btn" type="button" aria-expanded="true" aria-label="Minimise panel">–</button>
        </div>
        <div class="body">
          <div class="mission" hidden>
            <div class="mission-top"><span class="mission-label">Your mission</span><span class="mission-clock">0:00</span></div>
            <p class="mission-goal"></p>
            <div class="mission-actions">
              <button type="button" class="done-btn">I did it</button>
              <button type="button" class="giveup-btn">I give up</button>
            </div>
          </div>
          <div class="active-profiles"></div>
          <p class="hint"></p>
          <div class="friction" hidden>
            <span class="friction-count">0</span>
            <span class="friction-text">struggles noticed automatically</span>
            <div class="friction-last"></div>
          </div>
          <button class="empathy-btn" type="button" aria-expanded="false">I felt this</button>
          <div class="empathy-menu" role="group" aria-label="What happened?"></div>
          <div class="toast" role="status"></div>
          <button class="stop-btn" type="button">End session and see the report</button>
        </div>
      </div>
    `

    this.empathy = new EmpathyButtonView(this.shadow, ({ label, note }) => {
      this.dispatchEvent(new CustomEvent('empathy-moment', { detail: { label, note } }))
      this.empathy.confirm(label)
    })

    const collapse = this.shadow.querySelector('.collapse-btn')
    collapse.addEventListener('click', () => {
      const panel = this.shadow.querySelector('.panel')
      const collapsed = panel.classList.toggle('collapsed')
      collapse.setAttribute('aria-expanded', String(!collapsed))
      collapse.setAttribute('aria-label', collapsed ? 'Expand panel' : 'Minimise panel')
      collapse.textContent = collapsed ? '+' : '–'
    })

    const outcome = (value) => {
      this.shadow.querySelectorAll('.mission-actions button').forEach((b) => { b.disabled = true })
      this.shadow.querySelector('.mission-label').textContent = value === 'done' ? 'Done. Saving…' : 'Gave up. Saving…'
      this.setStopping(true)
      this.dispatchEvent(new CustomEvent('mission-outcome', { detail: { outcome: value } }))
    }
    this.shadow.querySelector('.done-btn').addEventListener('click', () => outcome('done'))
    this.shadow.querySelector('.giveup-btn').addEventListener('click', () => outcome('gave-up'))

    this.shadow.querySelector('.stop-btn').addEventListener('click', () => {
      this.setStopping(true)
      this.dispatchEvent(new CustomEvent('stop-simulation'))
    })

    this.frictionCount = 0
    this.startedAt = Date.now()
    this.timer = setInterval(() => this.tick(), 1000)
  }

  mount() {
    mountTopLayer(this.host)
    this.unkeep = keepOnTop(this.host)
    this.makeDraggable()
    this.restorePosition()
    return this
  }

  remove() {
    clearInterval(this.timer)
    this.unkeep?.()
    this.cleanupDrag?.()
    this.host.remove()
  }

  setStartedAt(ts) {
    if (ts) this.startedAt = ts
    this.tick()
  }

  tick() {
    const el = this.shadow.querySelector('.elapsed')
    if (el) el.textContent = formatElapsed(Date.now() - this.startedAt)
    const clock = this.shadow.querySelector('.mission-clock')
    if (clock) clock.textContent = this.missionStartedAt ? formatElapsed(Date.now() - this.missionStartedAt) : '0:00'
  }

  // mission: { goal } or null. baseline: the "as yourself" run.
  setMission(mission, { baseline = false, startedAt = null } = {}) {
    const box = this.shadow.querySelector('.mission')
    if (!mission?.goal) { box.hidden = true; return }
    box.hidden = false
    box.classList.toggle('baseline', baseline)
    this.shadow.querySelector('.mission-label').textContent = baseline ? 'Your mission, as yourself' : 'Your mission'
    this.shadow.querySelector('.mission-goal').textContent = mission.goal
    this.missionStartedAt = startedAt
    this.tick()
  }

  startMission(ts) {
    this.missionStartedAt = ts || Date.now()
    this.tick()
  }

  setStopping(isStopping) {
    const btn = this.shadow.querySelector('.stop-btn')
    btn.disabled = isStopping
    btn.textContent = isStopping ? 'Ending session…' : 'End session and see the report'
  }

  setProfiles(profiles) {
    const container = this.shadow.querySelector('.active-profiles')
    container.innerHTML = ''
    for (const p of profiles) {
      const chip = document.createElement('span')
      chip.className = 'chip'
      chip.textContent = p.name || p.id
      container.appendChild(chip)
    }
    // Keep clear of the screen reader's caption bar along the bottom edge.
    if (!this.customPosition) {
      const sr = profiles.some((p) => p.id === 'screen-reader')
      this.host.style.setProperty('bottom', sr ? '84px' : '20px', 'important')
    }
    const hints = profiles.map((p) => KEYBOARD_HINTS[p.id]).filter(Boolean)
    this.shadow.querySelector('.hint').textContent =
      hints.slice(0, 2).join(' ') || 'Use the page as you normally would. Everything is being recorded.'
  }

  setRecording(on) {
    this.shadow.querySelector('.recording-dot').classList.toggle('off', !on)
    this.shadow.querySelector('.rec').title = on ? 'Recording' : 'Not recording'
  }

  // An automatically noticed struggle (tremor misclick, unlabelled control,
  // lost focus...). Shown so the tester connects the feeling to the cause.
  noteFriction(text) {
    this.frictionCount += 1
    const box = this.shadow.querySelector('.friction')
    box.hidden = false
    this.shadow.querySelector('.friction-count').textContent = String(this.frictionCount)
    this.shadow.querySelector('.friction-text').textContent =
      this.frictionCount === 1 ? 'struggle noticed automatically' : 'struggles noticed automatically'
    this.shadow.querySelector('.friction-last').textContent = text
  }

  makeDraggable() {
    const header = this.shadow.querySelector('.header')
    let startX, startY, origRight, origBottom, dragging = false

    header.addEventListener('mousedown', (e) => {
      if (e.composedPath().some((n) => n.classList?.contains('collapse-btn'))) return
      dragging = true
      startX = e.clientX
      startY = e.clientY
      const rect = this.host.getBoundingClientRect()
      origRight = window.innerWidth - rect.right
      origBottom = window.innerHeight - rect.bottom
      e.preventDefault()
    })
    const move = (e) => {
      if (!dragging) return
      const right = Math.min(window.innerWidth - 80, Math.max(0, origRight - (e.clientX - startX)))
      const bottom = Math.min(window.innerHeight - 40, Math.max(0, origBottom - (e.clientY - startY)))
      this.host.style.setProperty('right', `${right}px`, 'important')
      this.host.style.setProperty('bottom', `${bottom}px`, 'important')
    }
    const up = () => {
      if (!dragging) return
      dragging = false
      this.customPosition = true
      try {
        chrome.storage.local.set({
          panelPosition: { right: this.host.style.right, bottom: this.host.style.bottom }
        })
      } catch { /* extension context gone */ }
    }
    window.addEventListener('mousemove', move, true)
    window.addEventListener('mouseup', up, true)
    this.cleanupDrag = () => {
      window.removeEventListener('mousemove', move, true)
      window.removeEventListener('mouseup', up, true)
    }
  }

  async restorePosition() {
    try {
      const { panelPosition } = await chrome.storage.local.get('panelPosition')
      if (panelPosition?.right && panelPosition?.bottom) {
        this.customPosition = true
        this.host.style.setProperty('right', panelPosition.right, 'important')
        this.host.style.setProperty('bottom', panelPosition.bottom, 'important')
      }
    } catch { /* defaults are fine */ }
  }
}

export function mountControlPanel() {
  if (typeof document === 'undefined') return null
  document.getElementById('accessgen-control-panel')?.remove()
  return new ControlPanel().mount()
}
