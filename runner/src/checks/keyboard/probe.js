import crypto from 'node:crypto'
import { stick } from '../../measuringStick.js'
import { roleWord, coverageLines } from '../../copy.js'

// The measurements the five keyboard detectors share, taken once per Tab
// stop in the measure pass (no filter, no overlay). Each detector calls
// probeStop at every stop; the first call measures, the others reuse it.
//
// Everything here is measured, never guessed:
//   - the element with focus, drilling through open shadow roots
//   - its name and role from the browser's accessibility tree (CDP)
//   - whether focus is inside a closed shadow root (CDP), which we skip
//   - its box, its opacity through all its parents, whether it is on screen
//   - what is on top at its centre and four inner corners, and whether
//     that paints
//   - which landmark, heading and cookie notice it sits in
//   - on request (diff): pictures and computed styles with focus and
//     without, by blurring it and putting focus back

// Known consent tools, recognised only by their own markers. Anything not
// listed here is never labelled a cookie notice.
export const COOKIE_MARKERS = [
  ['OneTrust', '#onetrust-consent-sdk, #onetrust-banner-sdk, #onetrust-pc-sdk'],
  ['Cookiebot', '#CybotCookiebotDialog'],
  ['Didomi', '#didomi-host, #didomi-popup'],
  ['Quantcast', '.qc-cmp2-container, #qc-cmp2-ui'],
  ['CookieYes', '.cky-consent-container, .cky-modal'],
  ['Usercentrics', '#usercentrics-root, #usercentrics-cmp-ui'],
  ['TrustArc', '#truste-consent-track, #truste-consent-content'],
  ['Osano', '.osano-cm-window'],
  ['iubenda', '#iubenda-cs-banner'],
  ['Complianz', '#cmplz-cookiebanner-container'],
  ['Sourcepoint', '[id^="sp_message_container"]'],
  ['Klaro', '.klaro']
]

// Computed styles compared with and without focus: the outline, shadow,
// border, background, underline and transform named in the moment's fact.
// Each group is read as one value. When a group starts with a style that
// paints nothing (an outline, border side or underline of "none"), the
// rest of the group is not compared: a colour or offset on something that
// is not drawn cannot be seen.
export const PAINT_STYLES = [
  ['outline-style', 'outline-width', 'outline-color', 'outline-offset'],
  ['box-shadow'],
  ['border-top-style', 'border-top-width', 'border-top-color'],
  ['border-right-style', 'border-right-width', 'border-right-color'],
  ['border-bottom-style', 'border-bottom-width', 'border-bottom-color'],
  ['border-left-style', 'border-left-width', 'border-left-color'],
  ['background-color'],
  ['background-image'],
  ['text-decoration-line', 'text-decoration-style', 'text-decoration-color', 'text-decoration-thickness'],
  ['transform']
]

const PROBE_KEY = 'accessgen.runner.probe'

// ---------------------------------------------------------------- in page
// Self-contained: Playwright serialises these, so no outside variables.

// Waits for focus to settle, then measures the focused element.
export async function readFocused({ settleCapMs, nearbyPx, insetPx, cookieMarkers, paintStyles }) {
  const KEY = Symbol.for('accessgen.runner.probe')
  const store = window[KEY] || (window[KEY] = { reached: new WeakSet(), current: null })

  let el = document.activeElement
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement
  if (!el || el === document.body || el === document.documentElement) return null

  const up = (n) => n.parentElement || (n.parentNode && n.parentNode.host) || null
  const chain = []
  for (let n = el; n; n = up(n)) chain.push(n)
  const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()))

  // Settle: two frames, then until scrolling and any finite animation on the
  // element or its parents has stopped (endless ones, such as a carousel,
  // never finish, so they are not waited for).
  await frame()
  await frame()
  const finite = (a) => a.playState === 'running' && a.effect && a.effect.getComputedTiming().endTime !== Infinity
  const t0 = performance.now()
  let last = ''
  let still = 0
  while (performance.now() - t0 < settleCapMs) {
    const r = el.getBoundingClientRect()
    const pos = [scrollX, scrollY, r.x, r.y, r.width, r.height].join(',')
    still = pos === last ? still + 1 : 0
    last = pos
    const moving = el.getAnimations({ subtree: true }).some(finite) || chain.slice(1).some((n) => n.getAnimations().some(finite))
    if (still >= 2 && !moving) break
    await frame()
  }

  const vw = window.innerWidth
  const vh = window.innerHeight
  const box = (n) => {
    const r = n.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }
  }
  // A screenshot clip: the box plus padding, cut to the screen. null when
  // nothing of it is on screen.
  const clipOf = (n, pad) => {
    const r = n.getBoundingClientRect()
    const x = Math.max(0, Math.floor(r.left - pad))
    const y = Math.max(0, Math.floor(r.top - pad))
    const right = Math.min(vw, Math.ceil(r.right + pad))
    const bottom = Math.min(vh, Math.ceil(r.bottom + pad))
    return right - x >= 1 && bottom - y >= 1 ? { x, y, width: right - x, height: bottom - y } : null
  }

  const r = el.getBoundingClientRect()
  let opacity = 1
  for (const n of chain) opacity *= parseFloat(getComputedStyle(n).opacity)
  const onScreen = r.right > 0 && r.bottom > 0 && r.left < vw && r.top < vh
  let hidden = null
  if (r.width === 0 || r.height === 0) hidden = { kind: 'zero', width: Math.round(r.width), height: Math.round(r.height) }
  else if (opacity === 0) hidden = { kind: 'transparent' }
  else if (!onScreen) hidden = { kind: 'offscreen', x: Math.round(r.x), y: Math.round(r.y) }

  // Styles on the element (and its ::before and ::after) and its 3 nearest parents.
  const styled = chain.slice(0, 4)
  const read = (cs) => paintStyles.map((group) => {
    const first = cs.getPropertyValue(group[0])
    if (group.length > 1 && (first === 'none' || first === 'hidden')) return 'none'
    return group.map((p) => cs.getPropertyValue(p)).join(' ')
  }).join('|')
  const styles = styled.map((n) => read(getComputedStyle(n)))
  styles.push(read(getComputedStyle(el, '::before')), read(getComputedStyle(el, '::after')))

  // Its label: a <label>, else the first element aria-labelledby names.
  let label = (el.labels && el.labels[0]) || null
  if (!label) {
    const root = el.getRootNode()
    for (const id of (el.getAttribute('aria-labelledby') || '').split(/\s+/).filter(Boolean)) {
      const n = (root.getElementById && root.getElementById(id)) || document.getElementById(id)
      if (n) { label = n; break }
    }
  }
  const parent = up(el)

  // What is on top at the centre and four inner corners.
  let cover = null
  if (!hidden) {
    const inset = Math.min(insetPx, r.width / 4, r.height / 4)
    const points = [
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + inset, r.top + inset], [r.right - inset, r.top + inset],
      [r.left + inset, r.bottom - inset], [r.right - inset, r.bottom - inset]
    ]
    const hit = (x, y) => {
      if (x < 0 || y < 0 || x >= vw || y >= vh) return null
      let h = document.elementFromPoint(x, y)
      while (h && h.shadowRoot) {
        const inner = h.shadowRoot.elementFromPoint(x, y)
        if (!inner || inner === h) break
        h = inner
      }
      return h
    }
    const hits = points.map(([x, y]) => hit(x, y))
    const top = hits[0]
    const partOfIt = (h) => { for (let n = h; n; n = up(n)) if (n === el) return true; return false }
    if (top && hits.every((h) => h === top) && !partOfIt(top) && !chain.includes(top)) {
      let topOpacity = 1
      for (let n = top; n; n = up(n)) topOpacity *= parseFloat(getComputedStyle(n).opacity)
      const cs = getComputedStyle(top)
      const alpha = (c) => {
        if (!c || c === 'transparent') return 0
        const m = c.match(/rgba?\(([^)]+)\)/)
        if (!m) return 1
        const parts = m[1].split(/[\s,/]+/).filter(Boolean)
        return parts.length >= 4 ? parseFloat(parts[3]) : 1
      }
      const background = alpha(cs.backgroundColor) > 0 || cs.backgroundImage !== 'none'
      const replaced = /^(img|svg|video|canvas|iframe|embed|object|input|select|textarea|button|picture)$/i.test(top.tagName)
      const text = Array.from(top.childNodes).some((c) => c.nodeType === 3 && c.textContent.trim())
      if (topOpacity > 0 && cs.visibility === 'visible' && (background || replaced || text)) {
        cover = { tag: top.tagName.toLowerCase(), box: box(top) }
        store.cover = top
      }
    }
  }

  const matchesAny = (sel) => chain.some((n) => n.matches && n.matches(sel))
  let cookie = null
  for (const [provider, sel] of cookieMarkers) if (matchesAny(sel)) { cookie = provider; break }
  const inDialog = matchesAny('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]')

  // Where the content starts: the main landmark, else the first heading.
  const visible = (n) => n.getClientRects().length > 0
  const main = Array.from(document.querySelectorAll('main, [role="main"]')).find(visible) || null
  const heading = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]')).find(visible) || null
  let headingInfo = null
  let afterHeading = false
  if (heading) {
    const level = heading.getAttribute('role') === 'heading'
      ? parseInt(heading.getAttribute('aria-level') || '2', 10)
      : parseInt(heading.tagName.slice(1), 10)
    headingInfo = { level, text: (heading.textContent || '').trim() }
    const inDocument = chain.find((n) => n.getRootNode() === document)
    if (inDocument) {
      const pos = heading.compareDocumentPosition(inDocument)
      afterHeading = inDocument === heading ||
        Boolean(pos & Node.DOCUMENT_POSITION_FOLLOWING) || Boolean(pos & Node.DOCUMENT_POSITION_CONTAINED_BY)
    }
  }

  // A same-page link: where it points, and whether that is on the page.
  let skipLink = null
  const href = el.tagName === 'A' ? el.getAttribute('href') || '' : ''
  if (href.startsWith('#') && href.length > 1) {
    let id = href.slice(1)
    try { id = decodeURIComponent(id) } catch { /* keep as written */ }
    skipLink = { id, exists: Boolean(document.getElementById(id) || document.getElementsByName(id).length) }
  }

  const textTypes = /^(text|search|email|url|tel|password|number|date|datetime-local|month|time|week)$/i
  const editable = el.isContentEditable || el.tagName === 'TEXTAREA' ||
    (el.tagName === 'INPUT' && textTypes.test(el.getAttribute('type') || 'text'))

  store.reached.add(el)
  store.current = { el, label }
  if (!cover) store.cover = null

  return {
    tag: el.tagName.toLowerCase(),
    rect: box(el),
    hidden,
    styles,
    parentsCompared: styled.length - 1,
    clips: {
      element: clipOf(el, nearbyPx),
      label: label ? clipOf(label, 0) : null,
      parent: parent ? clipOf(parent, 0) : null
    },
    label: label ? { text: (label.textContent || '').trim() } : null,
    cover,
    cookie,
    inDialog,
    mainExists: Boolean(main),
    insideMain: Boolean(main && chain.includes(main)),
    heading: headingInfo,
    afterHeading,
    skipLink,
    editable
  }
}

// Takes focus off the element just measured; returns the same styles read
// without focus.
export async function blurCurrent({ paintStyles }) {
  const cur = window[Symbol.for('accessgen.runner.probe')]?.current
  if (!cur) return null
  cur.el.blur()
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  const up = (n) => n.parentElement || (n.parentNode && n.parentNode.host) || null
  const chain = []
  for (let n = cur.el; n && chain.length < 4; n = up(n)) chain.push(n)
  const read = (cs) => paintStyles.map((group) => {
    const first = cs.getPropertyValue(group[0])
    if (group.length > 1 && (first === 'none' || first === 'hidden')) return 'none'
    return group.map((p) => cs.getPropertyValue(p)).join(' ')
  }).join('|')
  const styles = chain.map((n) => read(getComputedStyle(n)))
  styles.push(read(getComputedStyle(cur.el, '::before')), read(getComputedStyle(cur.el, '::after')))
  return styles
}

// Puts focus back where the walk left it. True when it is back.
export async function refocusCurrent() {
  const cur = window[Symbol.for('accessgen.runner.probe')]?.current
  if (!cur) return false
  cur.el.focus({ preventScroll: true })
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  let el = document.activeElement
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement
  return el === cur.el
}

// Focusable elements the walk never reached: tabbable, shown, not disabled
// and not inert. A radio group counts once, as Tab treats it.
export function countUnreached() {
  const reached = window[Symbol.for('accessgen.runner.probe')]?.reached || new WeakSet()
  const sel = 'a[href], area[href], button, input, select, textarea, summary, iframe, audio[controls], video[controls], ' +
    '[tabindex], [contenteditable]:not([contenteditable="false"])'
  const groups = new Set()
  let count = 0
  const visit = (root) => {
    for (const n of root.querySelectorAll(sel)) {
      if (n.tabIndex < 0 || n.disabled || n.closest('[inert]')) continue
      if (n.tagName === 'INPUT' && n.type === 'hidden') continue
      if (n.getClientRects().length === 0 || getComputedStyle(n).visibility !== 'visible') continue
      if (n.tagName === 'INPUT' && n.type === 'radio' && n.name) {
        const key = `${n.form ? 'f' : 'd'}:${n.name}`
        if (groups.has(key)) continue
        groups.add(key)
        const group = Array.from((n.form || root).querySelectorAll('input[type="radio"]')).filter((x) => x.name === n.name)
        if (group.some((x) => reached.has(x))) continue
        count++
        continue
      }
      if (!reached.has(n)) count++
    }
    for (const h of root.querySelectorAll('*')) if (h.shadowRoot) visit(h.shadowRoot)
  }
  visit(document)
  return count
}

// Which recognised cookie notice is showing right now, if any.
export function visibleCookieNotice(cookieMarkers) {
  for (const [provider, sel] of cookieMarkers) {
    const n = document.querySelector(sel)
    if (!n) continue
    const r = n.getBoundingClientRect()
    const cs = getComputedStyle(n)
    if (r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none') return provider
  }
  return null
}

// ------------------------------------------------------------ in Node

const pages = new WeakMap()

// Per page state for one measure pass, shared by the keyboard detectors.
export function pageState(page) {
  let s = pages.get(page)
  if (!s) {
    s = { probes: new Map(), lastStop: null, cdp: null, cookieAtLoad: undefined }
    pages.set(page, s)
  }
  return s
}

export async function releaseProbe(page) {
  const s = pages.get(page)
  if (s?.cdp) await s.cdp.detach().catch(() => {})
  pages.delete(page)
}

export const personaName = (ctx) => ctx.persona?.persona?.name || ctx.persona?.name || 'This person'

export const hashOf = (value) => crypto.createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 16)

export function readFocusedArgs() {
  return {
    settleCapMs: stick('keyboard', 'settleCapMs'),
    nearbyPx: stick('keyboard', 'nearbyPx'),
    insetPx: stick('keyboard', 'cornerInsetPx'),
    cookieMarkers: COOKIE_MARKERS,
    paintStyles: PAINT_STYLES
  }
}

// The same measurement, taken again in the recorded pass to confirm.
export async function readFocusedNow(page) {
  const data = await page.evaluate(readFocused, readFocusedArgs()).catch(() => null)
  return data ? { ...data, stylesHash: hashOf(data.styles) } : null
}

async function cdpFor(page, s) {
  if (!s.cdp) s.cdp = await page.context().newCDPSession(page)
  return s.cdp
}

async function objectIdOf(cdp, field) {
  const { result } = await cdp.send('Runtime.evaluate', {
    expression: `(window[Symbol.for(${JSON.stringify(PROBE_KEY)})] || {})${field}`
  })
  return result?.objectId || null
}

async function accessibleOf(cdp, objectId) {
  if (!objectId) return { name: '', role: '' }
  const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { objectId, fetchRelatives: false })
  const n = nodes?.[0]
  return { name: n?.name?.value ?? '', role: n?.role?.value ?? '' }
}

async function hasClosedShadowRoot(cdp, objectId) {
  if (!objectId) return false
  const { node } = await cdp.send('DOM.describeNode', { objectId, depth: 1, pierce: true })
  return (node?.shadowRoots || []).some((r) => r.shadowRootType === 'closed')
}

// Measures the stop the walk is on, once. ctx: { page, stop, step, note }
export function probeStop(ctx) {
  const s = pageState(ctx.page)
  if (!s.probes.has(ctx.step)) s.probes.set(ctx.step, measureStop(ctx, s))
  return s.probes.get(ctx.step)
}

async function measureStop({ page, stop, step, note }, s) {
  const prev = s.lastStop
  s.lastStop = stop
  const base = { step, stop }

  if (stop.kind === 'frame') {
    if (stop.crossOrigin && prev?.selector !== stop.selector) note?.(coverageLines.frameEntered(step))
    return { ...base, skip: 'frame' }
  }
  if (stop.kind !== 'element') return { ...base, skip: stop.kind }
  if (stop.revisit) return { ...base, skip: 'revisit' }

  const data = await page.evaluate(readFocused, readFocusedArgs())
  if (!data) return { ...base, skip: 'gone' }

  const cdp = await cdpFor(page, s)
  const elId = await objectIdOf(cdp, '.current?.el')
  const closedShadow = await hasClosedShadowRoot(cdp, elId).catch(() => false)
  const ax = await accessibleOf(cdp, elId).catch(() => ({ name: '', role: '' }))
  let cover = null
  if (data.cover) {
    const coverAx = await accessibleOf(cdp, await objectIdOf(cdp, '.cover')).catch(() => ({ name: '', role: '' }))
    cover = { ...data.cover, name: coverAx.name, role: roleWord(coverAx.role, data.cover.tag) }
  }

  const diffs = new Map()
  return {
    ...base,
    ...data,
    cover,
    closedShadow,
    name: ax.name,
    role: roleWord(ax.role, data.tag),
    stylesHash: hashOf(data.styles),
    // Pictures and styles with focus and without, for the named clips
    // ('element', 'label', 'parent'). Must be called while the walk is
    // still on this stop; detectors do that from onStop.
    diff(which) {
      const key = which.join(',')
      if (!diffs.has(key)) diffs.set(key, diffFocus(page, data, which))
      return diffs.get(key)
    }
  }
}

async function diffFocus(page, data, which) {
  const caret = data.editable ? 'initial' : 'hide'
  const clips = which.map((w) => data.clips[w])
  const shoot = (clip) => (clip ? page.screenshot({ clip, caret, type: 'png' }) : null)

  const focused = []
  for (const clip of clips) focused.push(await shoot(clip))
  // A text cursor blinks: a second picture half a second later catches it.
  let focusedLater = null
  if (data.editable && clips[0]) {
    await page.waitForTimeout(stick('keyboard', 'caretGapMs'))
    focusedLater = await shoot(clips[0])
  }

  const unfocusedStyles = await page.evaluate(blurCurrent, { paintStyles: PAINT_STYLES })
  const unfocused = []
  for (const clip of clips) unfocused.push(await shoot(clip))
  const restored = await page.evaluate(refocusCurrent)

  const differs = (a, b) => Boolean(a && b && !a.equals(b))
  const changed = {}
  which.forEach((w, i) => {
    changed[w] = differs(focused[i], unfocused[i]) || (i === 0 && differs(focusedLater, unfocused[0]))
  })
  return {
    changed,
    stylesChanged: JSON.stringify(unfocusedStyles) !== JSON.stringify(data.styles),
    restored
  }
}
