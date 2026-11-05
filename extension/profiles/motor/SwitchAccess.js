import { BaseProfile } from '../BaseProfile.js'
import { send } from '../../content-scripts/communicator.js'
import { reportFriction, describeElement } from '../../content-scripts/friction.js'

const SCAN_INTERVAL = { 1: 3000, 2: 2000, 3: 1500 }
const FOCUSABLE = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]'
const LONG_WAIT_STEPS = 12

function isScannable(el) {
  if (el.closest('[data-accessgen]') || el.disabled) return false
  const r = el.getBoundingClientRect()
  if (r.width === 0 || r.height === 0) return false
  const cs = getComputedStyle(el)
  return cs.visibility !== 'hidden' && cs.display !== 'none'
}

// One switch is all you have. The page scans every interactive element in
// sequence; Space activates the highlighted one. Everything else is blocked.
export class SwitchAccess extends BaseProfile {
  init() {
    this.items = []
    this.index = -1
    this.stepsSinceActivation = 0
    this.waitStartedAt = Date.now()
    this.activating = false

    this.injectStyle(`
      [data-accessgen-scan="current"] {
        outline: 4px solid #F59E0B !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.35), 0 0 24px rgba(245,158,11,0.5) !important;
        transition: box-shadow 0.2s;
      }
      * { cursor: none !important; }
    `, 'accessgen-switch-css')

    // Block all pointer input. The click this profile makes itself in
    // activateCurrent() must get through: it used to be blocked here too,
    // so pressing the switch never activated anything.
    const blockMouse = (e) => {
      if (this.activating) return
      if (e.target?.dataset?.accessgenPanel) return
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
    }
    for (const type of ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'pointerdown', 'pointerup', 'wheel']) {
      this.addListener(window, type, blockMouse, { capture: true, passive: false })
    }
    this.addListener(window, 'keydown', (e) => {
      if (e.target?.dataset?.accessgenPanel) return
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
      if (e.code === 'Space' && !e.repeat) this.activateCurrent()
    }, { capture: true })

    this.collect()
    const observer = new MutationObserver(() => this.queueCollect())
    this.addObserver(observer, document.body, { childList: true, subtree: true })

    this.startScanning()
  }

  collect() {
    const current = this.items[this.index]
    this.items = Array.from(document.querySelectorAll(FOCUSABLE)).filter(isScannable)
    // Keep the scan where it was when the page changes under it.
    const kept = current ? this.items.indexOf(current) : -1
    this.index = kept >= 0 ? kept : Math.min(this.index, this.items.length - 1)
  }

  queueCollect() {
    clearTimeout(this.collectTimer)
    this.collectTimer = setTimeout(() => this.collect(), 400)
  }

  startScanning() {
    this.addInterval(() => this.advance(), SCAN_INTERVAL[this.severity])
  }

  advance() {
    this.clearHighlight()
    if (this.items.length === 0) return
    this.index = (this.index + 1) % this.items.length
    this.stepsSinceActivation += 1
    const el = this.items[this.index]
    el.setAttribute('data-accessgen-scan', 'current')
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    send('session-event', {
      event: { type: 'switch-scan', index: this.index, total: this.items.length }
    })
  }

  clearHighlight() {
    document.querySelectorAll('[data-accessgen-scan]')
      .forEach((el) => el.removeAttribute('data-accessgen-scan'))
  }

  activateCurrent() {
    const el = this.items[this.index]
    if (!el) return
    const steps = this.stepsSinceActivation
    const seconds = Math.round((Date.now() - this.waitStartedAt) / 1000)
    this.activating = true
    try {
      el.focus({ preventScroll: true })
      el.click()
    } finally {
      this.activating = false
    }
    if (steps >= LONG_WAIT_STEPS) {
      reportFriction({
        kind: 'switch-long-wait',
        profileId: 'switch-access',
        target: el,
        headline: `${seconds} seconds of waiting to reach ${describeElement(el)}`,
        detail: `The highlight had to pass ${steps - 1} other places first, one at a time. Every extra link on the way is more waiting.`
      })
    }
    this.stepsSinceActivation = 0
    this.waitStartedAt = Date.now()
    send('session-event', {
      event: { type: 'switch-activate', label: el.textContent?.trim().slice(0, 60) || el.tagName }
    })
  }

  update(severity) {
    super.update(severity)
    for (const id of this.intervals) clearInterval(id)
    this.intervals = []
    this.startScanning()
  }

  destroy() {
    clearTimeout(this.collectTimer)
    this.clearHighlight()
    super.destroy()
  }
}
