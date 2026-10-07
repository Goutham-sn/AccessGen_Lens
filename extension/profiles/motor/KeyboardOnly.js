import { BaseProfile } from '../BaseProfile.js'
import { FocusOrderVisualiser } from '../../overlay/FocusVisualiser.js'
import { send } from '../../content-scripts/communicator.js'

const BLOCKED_EVENTS = [
  'mousedown', 'mouseup', 'click', 'dblclick',
  'mouseover', 'mouseenter', 'mouseleave',
  'mousemove', 'contextmenu', 'touchstart',
  'touchend', 'touchmove', 'pointerdown',
  'pointerup', 'pointermove'
]

// The mouse is gone. Only Tab / Shift+Tab / Enter / Space / arrows work.
export class KeyboardOnly extends BaseProfile {
  init() {
    this.tabOrder = []
    this.visualiser = new FocusOrderVisualiser()
    this.visualiser.mount()

    // Block every mouse and touch interaction, but let the AccessGen
    // control panel itself stay clickable, or the user can't log moments.
    // This runs on every mousemove/mouseover/etc across the whole page, so
    // it has to be cheap: composedPath() allocates and walks a full array
    // on every single call, which is real, measurable overhead at that
    // frequency. Standard UI events cross shadow boundaries "retargeted",
    // so a click inside the panel's shadow DOM already shows up here as
    // e.target === the panel's host element: no tree walk needed.
    const blocker = (e) => {
      if (e.target?.dataset?.accessgenPanel) return
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
    for (const type of BLOCKED_EVENTS) {
      this.addListener(window, type, blocker, { capture: true })
    }

    // Hide the cursor and force a strong, always-visible focus indicator
    // that overrides any outline:none on the page.
    this.injectStyle(`
      * { cursor: none !important; }
      *:focus {
        outline: 3px solid #005FCC !important;
        outline-offset: 3px !important;
      }
      *:focus:not(:focus-visible) {
        outline: 3px solid #005FCC !important;
      }
      *:focus-visible {
        outline: 3px solid #005FCC !important;
        outline-offset: 3px !important;
        box-shadow: 0 0 0 4px rgba(0,102,255,0.3) !important;
      }
    `, 'accessgen-keyboard-only-css')

    // Track every focus change: build the tab order, update the
    // visualiser, and stream to the web app.
    this.addListener(document, 'focusin', (e) => {
      const el = e.target
      if (!el || el.dataset?.accessgenPanel) return

      let index = this.tabOrder.indexOf(el)
      if (index === -1) {
        this.tabOrder.push(el)
        index = this.tabOrder.length - 1
        this.visualiser.addElement(el, index)
      }
      this.visualiser.setCurrentIndex(index)

      send('focus-change', {
        tabIndex: index + 1,
        element: {
          tag: el.tagName?.toLowerCase(),
          label: el.getAttribute?.('aria-label')
            || el.textContent?.trim().slice(0, 60)
            || el.getAttribute?.('placeholder')
            || el.tagName
        }
      })
    }, { capture: true })
  }

  destroy() {
    this.visualiser?.unmount()
    super.destroy()
  }
}
