import { BaseProfile } from '../BaseProfile.js'
import { reportFriction, describeElement } from '../../content-scripts/friction.js'
import { mouseOnlyTarget } from './keyboardScan.js'
import { watchKeyboard } from './keyboardWatch.js'

const BLOCKED_EVENTS = [
  'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick',
  'mouseover', 'mouseenter', 'mouseleave', 'mouseout',
  'mousemove', 'contextmenu', 'wheel', 'touchstart',
  'touchend', 'touchmove', 'pointerdown',
  'pointerup', 'pointermove', 'pointerover'
]

const LONG_WAY_PRESSES = 25

function isOurs(el) {
  return Boolean(el?.dataset?.accessgenPanel || el?.closest?.('[data-accessgen]'))
}

// The mouse is gone. Only Tab / Shift+Tab / Enter / Space / arrows work.
export class KeyboardOnly extends BaseProfile {
  init() {
    this.tabPresses = 0
    this.pressesSinceActivation = 0

    // Block every mouse, wheel and touch interaction. Keep:
    //  - the AccessGen panel (a click inside its shadow root is retargeted to
    //    the host, so e.target is the host),
    //  - clicks the keyboard makes: Enter on a link or button, Space on a
    //    button, and element.click() all fire a click with detail 0. Those
    //    used to be blocked too, so nothing on the page could be activated.
    const blocker = (e) => {
      if (e.target?.dataset?.accessgenPanel) return
      if ((e.type === 'click' || e.type === 'auxclick') && e.detail === 0 && !e.pointerType) return
      if (e.type === 'mousedown' || e.type === 'pointerdown') this.noticeMouseOnly(e.target)
      e.preventDefault()
      e.stopPropagation()
      e.stopImmediatePropagation()
    }
    for (const type of BLOCKED_EVENTS) {
      this.addListener(window, type, blocker, { capture: true, passive: false })
    }

    // The cursor is gone. The page's own focus styles are left exactly as
    // they are: if the page hides its focus ring, that is what a keyboard
    // user meets, and it is noticed below.
    this.injectStyle(`* { cursor: none !important; }`, 'accessgen-keyboard-only-css')

    // Look at the whole page once it has settled, and again a little later
    // for content that arrives after load. Each finding is reported once.
    // The page scan itself runs for every session (simulation-controller).
    this.scanTimers = []
    // Where each press of Tab goes, the focus ring, things covering it, loops.
    this.tabOrder = watchKeyboard({
      profileId: 'keyboard-only',
      addListener: (...args) => this.addListener(...args),
      onTab: () => {
        this.tabPresses += 1
        this.pressesSinceActivation += 1
        if (this.pressesSinceActivation === LONG_WAY_PRESSES) {
          reportFriction({
            kind: 'keyboard-long-way',
            profileId: 'keyboard-only',
            headline: `${LONG_WAY_PRESSES} presses of Tab without doing anything yet`,
            detail: 'Every link and button on the way has to be passed one press at a time. A mouse user would have clicked once.'
          })
        }
      },
      onKey: (e) => { if (e.key === 'Enter' || e.key === ' ') this.pressesSinceActivation = 0 }
    })
  }

  // The tester reached for the mouse on something that only a mouse can use.
  noticeMouseOnly(target) {
    if (!target || isOurs(target)) return
    const el = mouseOnlyTarget(target)
    if (!el) return
    reportFriction({
      kind: 'keyboard-mouse-only',
      profileId: 'keyboard-only',
      target: el,
      headline: `${describeElement(el)} can only be used with a mouse`,
      detail: 'It reacts to a click, but Tab never stops on it, so someone without a mouse cannot reach it at all.'
    })
  }

  destroy() {
    for (const t of this.scanTimers || []) clearTimeout(t)
    super.destroy()
  }
}
