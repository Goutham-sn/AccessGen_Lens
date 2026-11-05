// A look at the page, as soon as it loads, for the things a person without
// a mouse will run into. Keyboard Only and Switch Access used to report
// a problem only when the tester happened to hit that exact element, so
// most keyboard problems never reached the report.
//
// Every finding is a count of what is on the page, never a verdict, and
// each is reported once per page with the first example highlighted.

import { reportFriction, describeElement } from '../../content-scripts/friction.js'

const FOCUSABLE = 'a[href], button, input:not([type="hidden"]), select, textarea, summary, iframe, [tabindex], [contenteditable=""], [contenteditable="true"]'
const NATIVE_INTERACTIVE = /^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY|LABEL|OPTION|IFRAME|VIDEO|AUDIO)$/
const CANDIDATES = 'div, span, li, img, svg, i, p, td, tr, section, article, h1, h2, h3, h4, h5, h6, [onclick], [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"]'
const MAX_CANDIDATES = 5000
const LONG_WAY_STOPS = 15

function ours(el) {
  return Boolean(el.closest?.('[data-accessgen]'))
}

function visible(el) {
  const r = el.getBoundingClientRect()
  if (r.width < 8 || r.height < 8) return false
  const cs = getComputedStyle(el)
  return cs.visibility !== 'hidden' && cs.display !== 'none' && Number(cs.opacity) > 0
}

export function isFocusable(el) {
  if (el.disabled) return false
  if (el.matches('a[href], button, input:not([type="hidden"]), select, textarea, summary, iframe')) return el.tabIndex >= 0
  return el.hasAttribute('tabindex') && el.tabIndex >= 0
}

// The page's own cursor styles, with this extension's cursor:none rules
// switched off for the moment they are read (they hide every cursor, which
// used to make every "looks clickable" test fail).
function withPageCursors(fn) {
  const ourStyles = Array.from(document.querySelectorAll('style[id^="accessgen-"]'))
  const was = ourStyles.map((s) => s.disabled)
  ourStyles.forEach((s) => { s.disabled = true })
  try {
    return fn()
  } finally {
    ourStyles.forEach((s, i) => { s.disabled = was[i] })
  }
}

// Things that react to the mouse (a pointer cursor, a click handler in the
// markup, a button role) but that Tab can never reach.
export function findMouseOnly(root = document) {
  return withPageCursors(() => {
    const found = []
    const list = root.querySelectorAll(CANDIDATES)
    for (let i = 0; i < list.length && i < MAX_CANDIDATES; i++) {
      const el = list[i]
      if (NATIVE_INTERACTIVE.test(el.tagName) || ours(el) || isFocusable(el)) continue
      const role = el.getAttribute('role')
      const handler = el.hasAttribute('onclick') || role === 'button' || role === 'link' || role === 'tab' ||
        role === 'menuitem' || role === 'checkbox'
      const cs = getComputedStyle(el)
      const pointer = cs.cursor === 'pointer'
      if (!handler && !pointer) continue
      // Only the outermost of a clickable area: cursor is inherited.
      if (!handler && el.parentElement && getComputedStyle(el.parentElement).cursor === 'pointer') continue
      // Reachable through a link or button inside it or around it.
      if (el.closest('a[href], button, label, summary, [tabindex]:not([tabindex="-1"])')) continue
      if (el.querySelector(FOCUSABLE)) continue
      if (!visible(el)) continue
      found.push(el)
    }
    return found
  })
}

// Style rules that show something on :hover with no :focus or
// :focus-within twin: menus a keyboard can never open.
export function findHoverOnlyMenus() {
  const hover = []
  const focusSelectors = new Set()
  const walk = (rules) => {
    for (const rule of rules) {
      if (rule.cssRules && !rule.selectorText) { walk(rule.cssRules); continue }
      const sel = rule.selectorText
      if (!sel) continue
      if (/:focus(-within|-visible)?/.test(sel)) {
        for (const part of sel.split(',')) focusSelectors.add(part.replace(/:focus(-within|-visible)?/g, ':STATE').trim())
      }
      if (!sel.includes(':hover')) continue
      const st = rule.style
      const shows = (st.display && st.display !== 'none') || st.visibility === 'visible' ||
        (st.opacity && Number(st.opacity) > 0) || (st.maxHeight && st.maxHeight !== '0px') || st.transform
      if (!shows) continue
      for (const part of sel.split(',')) {
        if (!part.includes(':hover')) continue
        // The hidden thing is what comes after the :hover, e.g. ".menu:hover ul".
        const after = part.split(':hover').pop().trim()
        if (!after) continue
        hover.push({ selector: part.trim(), key: part.replace(/:hover/g, ':STATE').trim() })
      }
    }
  }
  for (const sheet of Array.from(document.styleSheets)) {
    try {
      if (sheet.ownerNode?.id?.startsWith('accessgen-')) continue
      walk(sheet.cssRules)
    } catch {
      // A stylesheet from another origin cannot be read: skipped.
    }
  }
  const menus = []
  for (const h of hover) {
    if (focusSelectors.has(h.key)) continue
    let targets = []
    try {
      targets = Array.from(document.querySelectorAll(h.selector.replace(/:hover/g, '')))
    } catch { continue }
    // Something that is hidden now and holds a link or a button.
    const hidden = targets.filter((t) => !ours(t) && getComputedStyle(t).display === 'none' && t.querySelector(FOCUSABLE))
    if (hidden.length) menus.push({ selector: h.selector, element: hidden[0], links: hidden[0].querySelectorAll(FOCUSABLE).length })
  }
  return menus
}

// The page's own Tab order, approximately: elements with a positive
// tabindex first (in that order), then the rest as they appear.
export function tabStops() {
  const all = Array.from(document.querySelectorAll(FOCUSABLE)).filter((el) => !ours(el) && isFocusable(el))
  const positive = all.filter((el) => el.tabIndex > 0).sort((a, b) => a.tabIndex - b.tabIndex)
  return { all, positive, ordered: positive.concat(all.filter((el) => el.tabIndex === 0)) }
}

// The outermost element around `target` that reacts to the mouse but that
// Tab cannot reach, or null.
export function mouseOnlyTarget(target) {
  if (!target || target.nodeType !== 1 || ours(target)) return null
  return withPageCursors(() => {
    let found = null
    for (let node = target, i = 0; node && node.nodeType === 1 && node !== document.body && i < 6; node = node.parentElement, i++) {
      if (NATIVE_INTERACTIVE.test(node.tagName) || isFocusable(node)) return null
      const role = node.getAttribute('role')
      if (node.hasAttribute('onclick') || /^(button|link|tab|menuitem|checkbox)$/.test(role || '') ||
          getComputedStyle(node).cursor === 'pointer') found = node
    }
    return found
  })
}

// only: which findings to look for (Switch Access has no Tab key, so the
// Tab order and skip link findings are for Keyboard Only).
export function scanForKeyboard(profileId, { only = ['mouse-only', 'hover-menu', 'tab-order', 'no-skip'] } = {}) {
  const mouseOnly = only.includes('mouse-only') ? findMouseOnly() : []
  if (mouseOnly.length) {
    reportFriction({
      kind: 'keyboard-mouse-only',
      profileId,
      target: mouseOnly[0],
      headline: mouseOnly.length === 1
        ? `${describeElement(mouseOnly[0])} can only be used with a mouse`
        : `${mouseOnly.length} things on this page can only be used with a mouse, like ${describeElement(mouseOnly[0])}`,
      detail: 'They look clickable, but Tab never stops on them. Without a mouse they cannot be reached at all.'
    })
  }

  const menus = only.includes('hover-menu') ? findHoverOnlyMenus() : []
  if (menus.length) {
    const links = menus.reduce((n, m) => n + m.links, 0)
    reportFriction({
      kind: 'keyboard-hover-menu',
      profileId,
      target: menus[0].element.parentElement || menus[0].element,
      headline: `${menus.length === 1 ? 'A menu opens' : `${menus.length} menus open`} only under a mouse pointer`,
      detail: `${links} link${links === 1 ? '' : 's'} inside ${menus.length === 1 ? 'it are' : 'them are'} hidden until the mouse hovers, so a keyboard user never sees them.`
    })
  }

  if (!only.includes('tab-order') && !only.includes('no-skip')) return
  const { all, positive, ordered } = tabStops()
  if (positive.length && only.includes('tab-order')) {
    reportFriction({
      kind: 'keyboard-tab-order',
      profileId,
      target: positive[0],
      headline: `Tab jumps out of order: ${describeElement(positive[0])} comes first`,
      detail: `${positive.length} place${positive.length === 1 ? ' is' : 's are'} pulled to the front of the Tab order, so focus jumps around the page instead of following it.`
    })
  }

  const main = document.querySelector('main, [role="main"]') || document.querySelector('h1')
  if (main && all.length && only.includes('no-skip')) {
    const before = ordered.findIndex((el) => main.contains(el) || (main.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING))
    // A skip link: one of the first few stops, pointing at the main
    // content (not any same-page link, which menus often are).
    const skip = ordered.slice(0, 3).some((el) => {
      const href = el.getAttribute?.('href') || ''
      if (!href.startsWith('#') || href.length < 2) return false
      let target = null
      try { target = document.getElementById(decodeURIComponent(href.slice(1))) } catch { return false }
      return Boolean(target && (target === main || main.contains(target) || target.contains(main) ||
        (target.compareDocumentPosition(main) & Node.DOCUMENT_POSITION_FOLLOWING && target.closest('main, [role="main"]'))))
    })
    const first = ordered[0]
    if (before >= LONG_WAY_STOPS && !skip) {
      reportFriction({
        kind: 'keyboard-no-skip',
        profileId,
        target: first,
        headline: `${before} presses of Tab before the main content, and no way to skip them`,
        detail: 'There is no "skip to content" link, so every visit starts by stepping through all of the menus, one press at a time.'
      })
    }
  }
}

// Enter or Space on something that says it is a button or link, and then
// nothing at all happens: no page change, no navigation, no focus move.
export function watchDeadKeys(profileId, addListener) {
  addListener(window, 'keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    const el = e.target
    if (!el || el.nodeType !== 1 || ours(el) || el.dataset?.accessgenPanel) return
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.isContentEditable) return
    // Native links and buttons always do something on Enter.
    if (el.matches('a[href], button, summary')) return
    const role = el.getAttribute('role')
    if (!role || !/^(button|link|tab|menuitem|checkbox|switch|option)$/.test(role)) return

    let changed = false
    const startUrl = location.href
    const observer = new MutationObserver((list) => {
      if (list.some((m) => !ours(m.target.nodeType === 1 ? m.target : m.target.parentElement || document.body))) changed = true
    })
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true })
    setTimeout(() => {
      observer.disconnect()
      if (changed || location.href !== startUrl || document.activeElement !== el) return
      reportFriction({
        kind: 'keyboard-dead-key',
        profileId,
        target: el,
        headline: `You pressed ${e.key === ' ' ? 'Space' : 'Enter'} on ${describeElement(el)} and nothing happened`,
        detail: 'It is announced and focused like a button, but it only answers a mouse click.'
      })
    }, 700)
  }, { capture: true })
}

// Something fixed or sticky (a header, a cookie banner, a chat button)
// sits on top of the place Tab just moved to.
export function checkCovered(el, profileId) {
  const r = el.getBoundingClientRect()
  if (r.width < 2 || r.height < 2) return
  const x = Math.min(window.innerWidth - 1, Math.max(0, r.left + r.width / 2))
  const y = Math.min(window.innerHeight - 1, Math.max(0, r.top + r.height / 2))
  const top = document.elementFromPoint(x, y)
  if (!top || top === el || el.contains(top) || top.contains(el) || ours(top)) return
  for (let n = top; n && n !== document.body; n = n.parentElement) {
    const pos = getComputedStyle(n).position
    if (pos === 'fixed' || pos === 'sticky') {
      reportFriction({
        kind: 'keyboard-focus-covered',
        profileId,
        target: el,
        headline: `Tab moved to ${describeElement(el)}, but ${describeElement(n)} covers it`,
        detail: 'A part of the page that stays in place sits on top of where focus is, so a keyboard user cannot see where they are.'
      })
      return
    }
  }
}

// Tab keeps cycling between the same few places outside any dialog: the
// person cannot get out.
export class TrapWatch {
  constructor(profileId) {
    this.profileId = profileId
    this.recent = []
  }

  push(el) {
    this.recent.push(el)
    if (this.recent.length > 16) this.recent.shift()
    if (this.recent.length < 16) return
    const distinct = new Set(this.recent)
    if (distinct.size > 4) return
    if (this.recent.some((n) => n.closest?.('dialog, [role="dialog"], [aria-modal="true"]'))) return
    if (tabStops().all.length <= distinct.size + 2) return // the whole page is only these
    reportFriction({
      kind: 'keyboard-trap',
      profileId: this.profileId,
      target: el,
      headline: `Tab keeps going round the same ${distinct.size} place${distinct.size === 1 ? '' : 's'}`,
      detail: 'The rest of the page cannot be reached with the keyboard from here. A keyboard user is stuck.'
    })
    this.recent = []
  }
}
