// What happens each time Tab is pressed, in any session: where focus went,
// whether anything on screen shows it, whether something covers it, and
// whether Tab goes round in a loop. Keyboard Only runs this as part of its
// simulation; every other session runs it too (simulation-controller), so a
// tester who presses Tab while simulating low vision or a tremor still has
// every keyboard problem noticed.

import { send } from '../../content-scripts/communicator.js'
import { reportFriction, describeElement } from '../../content-scripts/friction.js'
import { watchDeadKeys, checkCovered, TrapWatch } from './keyboardScan.js'

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

function lookOf(el) {
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

// Whether focus shows on screen is decided by comparing the element's look
// while focused with its look once focus has left it. Any change (an
// outline, a shadow, a colour, an underline, sliding into view, as a skip
// link does) counts. Only "nothing changed at all" is reported.
function checkFocusRing(el, profileId) {
  if (isOurs(el)) return
  const cs = getComputedStyle(el)
  const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0
  const shadow = cs.boxShadow && cs.boxShadow !== 'none'
  if (outline || shadow) return
  const focused = lookOf(el)
  const onLeave = () => {
    el.removeEventListener('focusout', onLeave, true)
    requestAnimationFrame(() => {
      if (!el.isConnected || document.activeElement === el) return
      const after = lookOf(el)
      if (Object.keys(focused).some((k) => focused[k] !== after[k])) return
      reportFriction({
        kind: 'keyboard-no-focus-ring',
        profileId,
        target: el,
        headline: `Tab moved to ${describeElement(el)}, and nothing on screen showed it`,
        detail: 'No outline, no colour change, nothing: a keyboard user has to guess where they are on the page.'
      })
    })
  }
  el.addEventListener('focusout', onLeave, true)
}

function checkWhereFocusWent(profileId) {
  // Tab past the last stop moves focus into the browser's own toolbar:
  // that is the page ending, not the page losing the person's place.
  if (!document.hasFocus()) return
  const el = document.activeElement
  if (!el || el === document.body || el === document.documentElement) {
    reportFriction({
      kind: 'keyboard-focus-lost',
      profileId,
      headline: 'Pressing Tab lost your place on the page',
      detail: 'Focus went nowhere visible. Someone using the keyboard has no idea where they are now.'
    })
    return
  }
  if (isOurs(el) || el.tagName === 'IFRAME') return
  if (!isVisiblyPlaced(el)) {
    reportFriction({
      kind: 'keyboard-focus-hidden',
      profileId,
      target: el,
      headline: `Tab landed on ${describeElement(el)}, which you cannot see`,
      detail: 'Something hidden or off screen still takes a stop in the Tab order.'
    })
  }
}

// addListener(target, type, fn, options): registers a listener that the
// caller removes when it stops. onTab(): optional, each press of Tab.
// Returns the Tab order seen so far.
export function watchKeyboard({ profileId = 'keyboard-only', addListener, onTab = null, onKey = null }) {
  const tabOrder = []
  const trap = new TrapWatch(profileId)
  let tabbing = false
  watchDeadKeys(profileId, addListener)

  addListener(window, 'keydown', (e) => {
    if (isOurs(e.target)) return
    if (e.key === 'Tab') {
      tabbing = true
      onTab?.()
      setTimeout(() => checkWhereFocusWent(profileId), 60)
    } else {
      onKey?.(e)
    }
  }, { capture: true })
  // A mouse click is not keyboard use: only focus moved by Tab is checked.
  addListener(window, 'mousedown', () => { tabbing = false }, { capture: true })

  addListener(document, 'focusin', (e) => {
    const el = e.target
    if (!el || isOurs(el) || !tabbing) return
    let index = tabOrder.indexOf(el)
    if (index === -1) {
      tabOrder.push(el)
      index = tabOrder.length - 1
    }
    checkFocusRing(el, profileId)
    trap.push(el)
    // After the browser has scrolled it into view.
    requestAnimationFrame(() => checkCovered(el, profileId))
    send('focus-change', {
      tabIndex: index + 1,
      element: {
        tag: el.tagName?.toLowerCase(),
        label: el.getAttribute?.('aria-label') || el.textContent?.trim().slice(0, 60) || el.getAttribute?.('placeholder') || el.tagName
      }
    })
  }, { capture: true })
  return tabOrder
}
