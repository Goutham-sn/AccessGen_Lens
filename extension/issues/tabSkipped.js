// Things on the page a person can click but that Tab never reaches: the
// keyboard goes straight past them, so without a mouse they cannot be used
// at all (WCAG 2.1.1 Keyboard, level A).
//
// Used by both the runner (Automated) and the extension (Manual), so both
// find exactly the same things. Both functions here are self-contained (no
// imports, no outer variables): the runner hands them to the browser as they
// are, with page.evaluate and context.addInitScript.
//
// What counts as "can be clicked":
//   - a real control (link, button, field, summary) taken out of the Tab
//     order with tabindex="-1"
//   - something with a widget role (button, link, checkbox, tab, ...) that
//     cannot take focus
//   - something with a click handler: an onclick attribute, a listener added
//     with addEventListener, a React, Vue, Angular or jQuery click handler
//     (recorded by installClickRecorder, in the page's own world)
//   - a link with no address (<a> without href) used as a button
//   - the outermost element that shows a hand pointer
//   - a label whose checkbox or radio button is hidden from the keyboard
// And what is left out, because a keyboard can still get there: anything
// inside or around something that takes focus, items of a menu, tab list or
// list box where one item takes focus and the arrow keys move between them
// (roving focus), a second link to the same address that Tab does reach,
// disabled controls, and whole-page areas (a backdrop, the page itself).

// Click handlers are noted by installClickRecorder (clickRecorder.js), in
// the page's own world; the scan reads the marks it leaves.

// Every clickable thing Tab skips, in page order, outermost only. Each item:
// { reason, how, tag, role, kind, name, selector, rect, html, control? }.
// reason: 'removed' (a real control with tabindex="-1") or 'no-focus'.
// how: 'tabindex', 'role', 'handler', 'no-href', 'pointer' or 'label'.
// withElements: also return the element itself (same world only).
export function findTabSkipped({ max = 200, withElements = false } = {}) {
  const ATTR = 'data-accessgen-clickable'
  try { document.dispatchEvent(new CustomEvent('accessgen-mark-clickable')) } catch { /* no recorder */ }

  const NATIVE = 'a[href], area[href], button, input:not([type="hidden"]), select, textarea, summary, iframe, audio[controls], video[controls], [contenteditable=""], [contenteditable="true"]'
  const WIDGET = /^(button|link|checkbox|radio|switch|tab|menuitem|menuitemcheckbox|menuitemradio|option|slider|spinbutton|combobox|textbox|searchbox|treeitem|gridcell|row|columnheader|rowheader)$/
  // Items that can be reached with the arrow keys once their group has focus.
  const COMPOSITE = '[role="listbox"], [role="menu"], [role="menubar"], [role="tablist"], [role="tree"], [role="treegrid"], [role="grid"], [role="radiogroup"], [role="toolbar"], [role="combobox"], [role="table"], select, datalist'
  const scrollW = Math.max(document.documentElement.scrollWidth, window.innerWidth)
  const viewArea = window.innerWidth * window.innerHeight

  const ours = (el) => Boolean(el.closest('[data-accessgen], #accessgen-control-panel, accessgen-runner-overlay'))
  const rendered = (el) => {
    if (!el.getClientRects().length) return false
    const cs = getComputedStyle(el)
    return cs.visibility === 'visible' && cs.display !== 'none'
  }
  // Can take keyboard focus with Tab.
  const tabbable = (el) => el.tabIndex >= 0 && !el.disabled && !el.closest('[inert]') && rendered(el) &&
    (el.matches(NATIVE) || el.hasAttribute('tabindex'))
  const shown = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) return false
    if (r.right + scrollX <= 0 || r.left + scrollX >= scrollW) return false // a slide parked off the page
    const cs = getComputedStyle(el)
    if (cs.visibility !== 'visible' || cs.display === 'none' || Number(cs.opacity) === 0) return false
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      if (n.hasAttribute('inert')) return false
      const s = n === el ? cs : getComputedStyle(n)
      if (Number(s.opacity) === 0) return false
    }
    return true
  }
  const nameOf = (el) => (el.getAttribute('aria-label') || el.getAttribute('alt') || el.getAttribute('title') ||
    (el.labels && el.labels[0] ? el.labels[0].innerText : '') ||
    el.innerText || el.textContent || el.getAttribute('placeholder') || el.getAttribute('value') ||
    el.querySelector?.('img[alt]')?.getAttribute('alt') || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  const kindOf = (el, role) => {
    const tag = el.tagName
    if (role) return role === 'menuitem' || role === 'menuitemcheckbox' || role === 'menuitemradio' ? 'menu item' : role
    if (tag === 'A') return 'link'
    if (tag === 'BUTTON' || tag === 'SUMMARY') return 'button'
    if (tag === 'SELECT') return 'list'
    if (tag === 'TEXTAREA') return 'text box'
    if (tag === 'INPUT') {
      const t = (el.type || 'text').toLowerCase()
      if (t === 'checkbox' || t === 'radio') return t === 'radio' ? 'radio button' : 'checkbox'
      if (t === 'submit' || t === 'button' || t === 'reset' || t === 'image') return 'button'
      return 'field'
    }
    if (tag === 'LABEL') return 'label'
    if (tag === 'IMG' || tag === 'svg' || tag === 'SVG') return 'picture'
    return 'element'
  }
  const selectorFor = (node) => {
    const parts = []
    let cur = node
    for (let depth = 0; cur && cur.nodeType === 1 && depth < 12; depth++) {
      if (cur.id && document.querySelectorAll(`#${CSS.escape(cur.id)}`).length === 1) {
        parts.unshift(`#${CSS.escape(cur.id)}`)
        break
      }
      const tag = cur.tagName.toLowerCase()
      const parent = cur.parentElement
      if (!parent) { parts.unshift(tag); break }
      const same = Array.from(parent.children).filter((c) => c.tagName === cur.tagName)
      parts.unshift(same.length > 1 ? `${CSS.escape(tag)}:nth-of-type(${same.indexOf(cur) + 1})` : CSS.escape(tag))
      cur = parent
    }
    return parts.join(' > ')
  }
  const htmlOf = (el) => {
    const clone = el.cloneNode(true)
    clone.removeAttribute?.(ATTR)
    for (const n of clone.querySelectorAll('*')) {
      n.removeAttribute(ATTR)
      if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') n.textContent = ''
    }
    return clone.outerHTML.replace(/\s+/g, ' ').trim().slice(0, 240)
  }
  // A focusable thing in its roving-focus group (tabs, a menu, a toolbar).
  const rovingGroupReached = (el) => {
    const group = el.parentElement?.closest(COMPOSITE)
    if (!group) return false
    if (tabbable(group)) return true // aria-activedescendant style
    // A list box opened from a field (a combobox): the field holds focus.
    if (group.id) {
      for (const owner of document.querySelectorAll('[aria-controls], [aria-owns]')) {
        const ids = `${owner.getAttribute('aria-controls') || ''} ${owner.getAttribute('aria-owns') || ''}`.split(/\s+/)
        if (ids.includes(group.id) && tabbable(owner)) return true
      }
    }
    for (const item of group.querySelectorAll('*')) if (item !== el && tabbable(item)) return true
    return false
  }
  const insideTabbable = (el) => {
    for (let n = el.parentElement; n && n.nodeType === 1; n = n.parentElement) if (tabbable(n)) return true
    return false
  }
  const holdsTabbable = (el) => {
    for (const n of el.querySelectorAll('*')) if (tabbable(n)) return true
    return false
  }
  const inPointerArea = (el) => {
    const p = el.parentElement
    return Boolean(p && p !== document.body && getComputedStyle(p).cursor === 'pointer')
  }

  // The page's own cursors, with the extension's cursor:none styles off.
  const ourStyles = Array.from(document.querySelectorAll('style[id^="accessgen-"]'))
  const was = ourStyles.map((s) => s.disabled)
  ourStyles.forEach((s) => { s.disabled = true })

  const found = []
  const flagged = []
  const linkHrefsReached = new Set()
  try {
    for (const a of document.querySelectorAll('a[href]')) if (tabbable(a)) linkHrefsReached.add(a.href)
    const all = document.querySelectorAll('body *')
    for (let i = 0; i < all.length && found.length < max; i++) {
      const el = all[i]
      const tag = el.tagName
      if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'OPTION' || tag === 'OPTGROUP' || tag === 'HTML' || tag === 'BODY' || tag === 'NOSCRIPT' || tag === 'TEMPLATE') continue
      if (ours(el)) continue
      if (flagged.some((f) => f.contains(el))) continue // outermost only
      if (el.disabled || el.getAttribute('aria-disabled') === 'true') continue
      if (tabbable(el)) continue

      const role = (el.getAttribute('role') || '').trim().split(/\s+/)[0]
      let reason = null
      let how = null
      let control = null

      if (el.matches(NATIVE)) {
        // A real control. Not reachable: tabindex="-1" (or a negative one).
        if (!el.hasAttribute('tabindex') || el.tabIndex >= 0) continue
        if (tag === 'IFRAME') continue
        if (tag === 'INPUT' && el.type === 'radio' && el.name) {
          const group = Array.from((el.form || document).querySelectorAll('input[type="radio"]')).filter((x) => x.name === el.name)
          if (group.some((x) => tabbable(x))) continue
        }
        if (tag === 'A' && linkHrefsReached.has(el.href)) continue // the same link, reachable elsewhere
        if (rovingGroupReached(el)) continue // tabs, menus: the arrow keys move between them
        reason = 'removed'
        how = 'tabindex'
      } else {
        const hasRole = WIDGET.test(role)
        const handler = el.hasAttribute(ATTR) || el.hasAttribute('onclick')
        const noHref = tag === 'A' && !el.hasAttribute('href')
        let pointer = false
        if (!hasRole && !handler) {
          pointer = getComputedStyle(el).cursor === 'pointer' && !inPointerArea(el)
        }
        if (tag === 'LABEL') {
          // A label passes its click on to its control; a problem only when
          // that control is hidden from the keyboard (a styled checkbox).
          control = el.control
          if (!control || tabbable(control) || control.disabled) continue
          if (!/^(checkbox|radio)$/i.test(control.type || '') && control.tagName !== 'SELECT') continue
          reason = 'no-focus'
          how = 'label'
        } else if (hasRole || handler || pointer) {
          if (role === 'row' || role === 'gridcell' || role === 'columnheader' || role === 'rowheader') {
            if (!handler) continue // a plain data table, not a widget
          }
          reason = 'no-focus'
          how = hasRole ? 'role' : handler ? (noHref ? 'no-href' : 'handler') : (noHref ? 'no-href' : 'pointer')
        } else {
          continue
        }
        if (how !== 'label') {
          if (insideTabbable(el) || holdsTabbable(el)) continue
          if (el.closest('label')) continue // clicking it clicks the label's control
          if (rovingGroupReached(el)) continue
        }
      }

      if (!shown(el)) continue
      const r = el.getBoundingClientRect()
      // A whole-page area (the page itself, a backdrop) is not a control.
      if (how !== 'tabindex' && how !== 'role' && r.width * r.height > 0.4 * viewArea) continue
      if (how === 'pointer' && !nameOf(el) && !el.querySelector('img, svg, picture, canvas') && r.width * r.height < 64) continue

      flagged.push(el)
      const item = {
        reason,
        how,
        tag: tag.toLowerCase(),
        role: role || null,
        kind: kindOf(el, WIDGET.test(role) ? role : null),
        name: nameOf(el),
        selector: selectorFor(el),
        rect: { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), width: Math.round(r.width), height: Math.round(r.height) },
        viewRect: { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height), vw: window.innerWidth, vh: window.innerHeight },
        html: htmlOf(el)
      }
      if (control) item.control = { kind: kindOf(control, null), name: nameOf(el) }
      if (withElements) item.element = el
      found.push(item)
    }
  } finally {
    ourStyles.forEach((s, i) => { s.disabled = was[i] })
    for (const n of document.querySelectorAll(`[${ATTR}]`)) n.removeAttribute(ATTR)
  }
  return found
}

// The moment text for one skipped thing, in plain words.
export function skippedCopy(item, personName = 'Someone using only a keyboard') {
  const what = item.name ? `the ${item.kind} "${item.name.length > 60 ? `${item.name.slice(0, 60)}…` : item.name}"` : `an unnamed ${item.kind}`
  const headline = `Tab skips ${what}`
  let fact
  if (item.how === 'tabindex') {
    fact = `It is a real ${item.kind}, but tabindex="-1" takes it out of the Tab order. ${personName} presses Tab and focus jumps straight past it, so it cannot be used without a mouse.`
  } else if (item.how === 'role') {
    fact = `It says it is a ${item.kind}, but it can never take keyboard focus. ${personName} presses Tab and goes straight past it.`
  } else if (item.how === 'label') {
    fact = `The ${item.control?.kind || 'control'} behind it is hidden in a way that also hides it from the keyboard. Only a mouse click on the label works; Tab never stops there.`
  } else if (item.how === 'no-href') {
    fact = `It works as a link or button with a mouse, but it has no address and no keyboard focus. ${personName} presses Tab and goes straight past it.`
  } else if (item.how === 'pointer') {
    fact = `It shows a hand pointer, as if it could be clicked, but it cannot take keyboard focus. ${personName} presses Tab and goes straight past it.`
  } else {
    fact = `It reacts to a mouse click, but it is not a link or a button and cannot take keyboard focus. ${personName} presses Tab and goes straight past it, so it cannot be used without a mouse.`
  }
  const forTeam = item.how === 'tabindex'
    ? 'Remove tabindex="-1" so it is back in the Tab order.'
    : item.how === 'label'
    ? 'Hide the real input visually only (not with display:none or visibility:hidden), so it can still take focus.'
    : 'Use a real <button> or <a href>, or add tabindex="0" with Enter and Space handling.'
  return { headline, fact, forTeam }
}

// Places pulled to the front of the Tab order with a positive tabindex
// (WCAG 2.4.3 Focus Order, level A): Tab visits them first, wherever they
// are, then jumps back to the top. Self-contained, like findTabSkipped.
export function findForcedOrder() {
  const out = []
  for (const el of document.querySelectorAll('[tabindex]')) {
    if (!(el.tabIndex > 0) || el.disabled || el.closest('[data-accessgen], [inert]')) continue
    if (!el.getClientRects().length || getComputedStyle(el).visibility !== 'visible') continue
    const parts = []
    let cur = el
    for (let depth = 0; cur && cur.nodeType === 1 && depth < 12; depth++) {
      if (cur.id && document.querySelectorAll(`#${CSS.escape(cur.id)}`).length === 1) { parts.unshift(`#${CSS.escape(cur.id)}`); break }
      const tag = cur.tagName.toLowerCase()
      const parent = cur.parentElement
      if (!parent) { parts.unshift(tag); break }
      const same = Array.from(parent.children).filter((c) => c.tagName === cur.tagName)
      parts.unshift(same.length > 1 ? `${CSS.escape(tag)}:nth-of-type(${same.indexOf(cur) + 1})` : CSS.escape(tag))
      cur = parent
    }
    const name = (el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)
    out.push({ selector: parts.join(' > '), tabindex: el.tabIndex, name, tag: el.tagName.toLowerCase() })
  }
  return out.sort((a, b) => a.tabindex - b.tabindex)
}

export function forcedOrderCopy(list, personName = 'Someone using only a keyboard') {
  const first = list[0]
  const what = first.name ? `"${first.name}"` : `a ${first.tag}`
  return {
    headline: `Tab jumps out of order: ${what} comes first`,
    fact: `${list.length === 1 ? 'One place is' : `${list.length} places are`} pulled to the front of the Tab order with a positive tabindex. ${personName} presses Tab and focus jumps around the page instead of following it.`,
    forTeam: 'Use tabindex="0" (or none) and put things in the order they should be reached.'
  }
}
