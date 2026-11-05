import { BaseProfile } from '../BaseProfile.js'
import { FocusOrderVisualiser } from '../../overlay/FocusVisualiser.js'
import { send } from '../../content-scripts/communicator.js'
import { reportFriction, describeElement } from '../../content-scripts/friction.js'
import { scanForKeyboard, watchDeadKeys, checkCovered, mouseOnlyTarget, TrapWatch } from './keyboardScan.js'

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

function isVisiblyPlaced(el) {
  const r = el.getBoundingClientRect()
  if (r.width < 2 || r.height < 2) return false
  const cs = getComputedStyle(el)
  if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false
  // Entirely outside the viewport, even after the browser scrolled to it.
  return r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth
}

// The mouse is gone. Only Tab / Shift+Tab / Enter / Space / arrows work.
export class KeyboardOnly extends BaseProfile {
  init() {
    this.tabOrder = []
    this.tabPresses = 0
    this.pressesSinceActivation = 0
    this.visualiser = new FocusOrderVisualiser()
    this.visualiser.mount()

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
    this.scanTimers = [
      setTimeout(() => scanForKeyboard('keyboard-only'), 1200),
      setTimeout(() => scanForKeyboard('keyboard-only'), 6000)
    ]
    watchDeadKeys('keyboard-only', (...args) => this.addListener(...args))
    this.trap = new TrapWatch('keyboard-only')

    this.addListener(window, 'keydown', (e) => {
      if (isOurs(e.target)) return
      if (e.key === 'Tab') {
        this.tabPresses += 1
        this.pressesSinceActivation += 1
        setTimeout(() => this.checkWhereFocusWent(), 60)
        if (this.pressesSinceActivation === LONG_WAY_PRESSES) {
          reportFriction({
            kind: 'keyboard-long-way',
            profileId: 'keyboard-only',
            headline: `${LONG_WAY_PRESSES} presses of Tab without doing anything yet`,
            detail: 'Every link and button on the way has to be passed one press at a time. A mouse user would have clicked once.'
          })
        }
      } else if (e.key === 'Enter' || e.key === ' ') {
        this.pressesSinceActivation = 0
      }
    }, { capture: true })

    // Track every focus change: build the tab order, update the
    // visualiser, and stream to the web app.
    this.addListener(document, 'focusin', (e) => {
      const el = e.target
      if (!el || isOurs(el)) return

      let index = this.tabOrder.indexOf(el)
      if (index === -1) {
        this.tabOrder.push(el)
        index = this.tabOrder.length - 1
        this.visualiser.addElement(el, index)
      }
      this.visualiser.setCurrentIndex(index)
      this.checkFocusRing(el)
      this.trap.push(el)
      // After the browser has scrolled it into view.
      requestAnimationFrame(() => checkCovered(el, 'keyboard-only'))

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

  checkWhereFocusWent() {
    // Tab past the last stop moves focus into the browser's own toolbar:
    // that is the page ending, not the page losing the person's place.
    if (!document.hasFocus()) return
    const el = document.activeElement
    if (!el || el === document.body || el === document.documentElement) {
      reportFriction({
        kind: 'keyboard-focus-lost',
        profileId: 'keyboard-only',
        headline: 'Pressing Tab lost your place on the page',
        detail: 'Focus went nowhere visible. Someone using the keyboard has no idea where they are now.'
      })
      return
    }
    if (isOurs(el) || el.tagName === 'IFRAME') return
    if (!isVisiblyPlaced(el)) {
      reportFriction({
        kind: 'keyboard-focus-hidden',
        profileId: 'keyboard-only',
        target: el,
        headline: `Tab landed on ${describeElement(el)}, which you cannot see`,
        detail: 'Something hidden or off screen still takes a stop in the Tab order.'
      })
    }
  }

  // Whether focus shows on screen is decided by comparing the element's
  // look while focused with its look once focus has left it. Any change
  // (an outline, a shadow, a colour, an underline, sliding into view, as a
  // skip link does) counts. Only "nothing changed at all" is reported.
  checkFocusRing(el) {
    if (isOurs(el)) return
    const cs = getComputedStyle(el)
    const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0
    const shadow = cs.boxShadow && cs.boxShadow !== 'none'
    if (outline || shadow) return
    const focused = this.lookOf(el)
    const onLeave = () => {
      el.removeEventListener('focusout', onLeave, true)
      requestAnimationFrame(() => {
        if (!el.isConnected || document.activeElement === el) return
        const after = this.lookOf(el)
        if (Object.keys(focused).some((k) => focused[k] !== after[k])) return
        reportFriction({
          kind: 'keyboard-no-focus-ring',
          profileId: 'keyboard-only',
          target: el,
          headline: `Tab moved to ${describeElement(el)}, and nothing on screen showed it`,
          detail: 'No outline, no colour change, nothing: a keyboard user has to guess where they are on the page.'
        })
      })
    }
    el.addEventListener('focusout', onLeave, true)
  }

  lookOf(el) {
    const cs = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    return {
      outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`,
      shadow: cs.boxShadow,
      bg: cs.backgroundColor,
      color: cs.color,
      border: `${cs.borderTopColor} ${cs.borderBottomColor} ${cs.borderTopWidth} ${cs.borderBottomWidth}`,
      deco: cs.textDecorationLine,
      transform: cs.transform,
      opacity: cs.opacity,
      // Position on the page, so scrolling does not count as a change.
      place: `${Math.round(r.left + window.scrollX)},${Math.round(r.top + window.scrollY)},${Math.round(r.width)}`
    }
  }

  destroy() {
    for (const t of this.scanTimers || []) clearTimeout(t)
    this.visualiser?.unmount()
    super.destroy()
  }
}
