import { BaseProfile } from '../BaseProfile.js'
import { send } from '../../content-scripts/communicator.js'

const SCAN_INTERVAL = { 1: 3000, 2: 2000, 3: 1500 }
const FOCUSABLE = 'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="link"]'

// One switch is all you have. The page scans every interactive element in
// sequence; Space activates the highlighted one. Everything else is blocked.
export class SwitchAccess extends BaseProfile {
  init() {
    this.items = []
    this.index = -1

    this.injectStyle(`
      [data-accessgen-scan="current"] {
        outline: 4px solid #F59E0B !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 0 8px rgba(245, 158, 11, 0.35), 0 0 24px rgba(245,158,11,0.5) !important;
        transition: box-shadow 0.2s;
      }
      * { cursor: none !important; }
    `, 'accessgen-switch-css')

    // Block all input except Space.
    const blockMouse = (e) => {
      if (e.target?.dataset?.accessgenPanel) return
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
    }
    for (const type of ['mousedown', 'mouseup', 'click', 'dblclick', 'contextmenu', 'pointerdown', 'pointerup']) {
      this.addListener(window, type, blockMouse, { capture: true })
    }
    this.addListener(window, 'keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
        this.activateCurrent()
      } else {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation()
      }
    }, { capture: true })

    this.collect()
    const observer = new MutationObserver(() => this.queueCollect())
    this.addObserver(observer, document.body, { childList: true, subtree: true })

    this.startScanning()
  }

  collect() {
    this.items = Array.from(document.querySelectorAll(FOCUSABLE)).filter((el) => {
      if (el.dataset.accessgen || el.closest('[data-accessgen]')) return false
      const rect = el.getBoundingClientRect()
      return rect.width > 0 && rect.height > 0
    })
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
    el.focus()
    el.click()
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
