// Functions that run inside the page via page.evaluate. Each one must be
// self-contained: Playwright serializes it, so no outside variables.

// For the readiness wait (load.js): how many DOM changes this document has
// had since it was first asked, and whether it has anything to show yet
// (visible text, or something Tab can reach). The observer only counts; a
// new document after a navigation starts its own count.
export function contentState() {
  const KEY = Symbol.for('accessgen.runner.ready')
  let state = window[KEY]
  if (!state) {
    state = window[KEY] = { changes: 0, hasContent: false }
    new MutationObserver((list) => { state.changes += list.length })
      .observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true })
  }
  if (!state.hasContent && document.body) {
    const text = (document.body.innerText || '').trim().length > 0
    const focusable = !text && Array.from(document.querySelectorAll(
      'a[href], button, input, select, textarea, summary, [tabindex], [contenteditable]'
    )).some((n) => n.tabIndex >= 0 && !n.disabled && n.getClientRects().length > 0)
    state.hasContent = text || focusable
  }
  return { changes: state.changes, hasContent: state.hasContent }
}

// Two animation frames: style, layout and paint have caught up.
export function settle() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

// What has focus right now, drilling into open shadow roots.
export function describeActive() {
  let el = document.activeElement
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement

  if (!el || el === document.body || el === document.documentElement) {
    return { kind: 'body', selector: 'body', name: '', tag: 'body', role: null, rect: null }
  }

  function selectorFor(node) {
    const parts = []
    let cur = node
    for (let depth = 0; cur && cur.nodeType === 1 && depth < 8; depth++) {
      if (cur.id && document.querySelectorAll(`#${CSS.escape(cur.id)}`).length === 1) {
        parts.unshift(`#${CSS.escape(cur.id)}`)
        break
      }
      const tag = cur.tagName.toLowerCase()
      const parent = cur.parentElement
      if (!parent) { parts.unshift(tag); break }
      const same = Array.from(parent.children).filter((c) => c.tagName === cur.tagName)
      parts.unshift(same.length > 1 ? `${tag}:nth-of-type(${same.indexOf(cur) + 1})` : tag)
      cur = parent
    }
    return parts.join(' > ')
  }

  const r = el.getBoundingClientRect()
  const name = (el.getAttribute('aria-label') || el.getAttribute('alt') || el.getAttribute('title') ||
    el.textContent || el.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 80)

  const isFrame = el.tagName === 'IFRAME' || el.tagName === 'FRAME'
  // A frame from another site has no readable document from here.
  let crossOrigin = false
  if (isFrame) {
    try { crossOrigin = !el.contentDocument } catch { crossOrigin = true }
  }

  return {
    kind: isFrame ? 'frame' : 'element',
    ...(isFrame ? { crossOrigin } : {}),
    selector: selectorFor(el),
    name,
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role'),
    rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }
  }
}

// Signs of a bot wall (a CAPTCHA or "are you human" check), and how much
// content the page has of its own. We never try to get around one; see
// botWall.js for the rule that decides whether to stop.
//
// Three kinds of sign:
//   marker  an element a challenge service puts on the page (a Cloudflare
//           challenge form, a reCAPTCHA, hCaptcha or Turnstile box, ...)
//   frame   a frame from a CAPTCHA service
//   title   a title such as "Just a moment" or "Verify you are human"
// Content of its own is counted outside the marker elements and outside
// every frame: visible text (characters other than spaces), visible form
// fields, and visible links and buttons.
export function detectChallenge() {
  const MARKERS = ['#challenge-form', '#challenge-running', '[id^="cf-chl"]', '.cf-turnstile', '.g-recaptcha', '.h-captcha', '#px-captcha']
  const FRAME = /recaptcha|hcaptcha\.com|challenges\.cloudflare\.com|turnstile|arkoselabs|funcaptcha/i
  const TITLE = /just a moment|attention required|verify you are human|are you a robot|access denied|security check/i
  const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'
  const chars = (s) => (String(s || '').match(/\S/g) || []).length

  const markerSelector = MARKERS.find((sel) => document.querySelector(sel)) || null
  const markerEls = Array.from(document.querySelectorAll(MARKERS.join(',')))
  const frame = Array.from(document.querySelectorAll('iframe')).find((f) => FRAME.test(f.src || ''))
  let frameHost = null
  if (frame) { try { frameHost = new URL(frame.src).host } catch { frameHost = '' } }
  const title = (document.title || '').trim().replace(/\s+/g, ' ').slice(0, 80)

  const outside = (el) => !markerEls.some((m) => m.contains(el))
  // Text inside shown markers is taken off the page's own count; outermost
  // markers only, so nested ones are not taken off twice.
  const outer = markerEls.filter((m) => !markerEls.some((o) => o !== m && o.contains(m)))
  const body = document.body
  const textChars = Math.max(0, chars(body?.innerText) -
    outer.filter(shown).reduce((n, m) => n + chars(m.innerText), 0))
  const own = (sel) => (body ? Array.from(body.querySelectorAll(sel)) : []).filter((el) => outside(el) && shown(el)).length

  const rules = []
  if (markerSelector) rules.push('marker')
  if (frame) rules.push('frame')
  if (TITLE.test(title)) rules.push('title')
  return {
    rules,
    marker: markerSelector,
    frameHost,
    title,
    textChars,
    fields: own('input:not([type="hidden"]), select, textarea'),
    controls: own('a[href], button, [role="button"], [role="link"]')
  }
}

// Is a modal dialog open right now? We leave it alone and note it.
export function detectModal() {
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
  }
  return Array.from(document.querySelectorAll('dialog[open], [role="dialog"], [role="alertdialog"], [aria-modal="true"]'))
    .some(visible)
}

// Scrolls one step down. Returns true at the bottom.
export function scrollStep(stepPx) {
  const before = window.scrollY
  window.scrollBy({ top: stepPx, behavior: 'instant' })
  const atBottom = Math.ceil(window.scrollY + window.innerHeight) >= document.documentElement.scrollHeight
  return atBottom || window.scrollY === before
}

// Video-only overlay: the key chip, the moment highlight and the caption.
// Fixed position, pointer-events none, aria-hidden, inside a closed shadow
// root, so it cannot take focus, change layout, catch elementFromPoint, or
// show up in the accessibility tree. It is only ever drawn after the
// measurements for a step have been taken.
export function installOverlay() {
  const KEY = Symbol.for('accessgen.runner.overlay')
  if (window[KEY]) return
  const host = document.createElement('accessgen-runner-overlay')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;display:block;'
  const root = host.attachShadow({ mode: 'closed' })
  root.innerHTML = `
    <style>
      * { box-sizing: border-box; }
      .chip { position: fixed; right: 24px; bottom: 24px; display: none; align-items: center; gap: 10px;
        font: 600 22px/1 system-ui, -apple-system, "Segoe UI", sans-serif; color: #fff;
        background: rgba(17, 24, 39, 0.92); border: 2px solid #fff; border-radius: 12px; padding: 10px 14px; }
      .key { background: #fff; color: #111827; border-radius: 6px; padding: 6px 10px; }
      .count { font-variant-numeric: tabular-nums; }
      .ring { position: fixed; display: none; border: 4px solid #ff00ff; border-radius: 6px;
        box-shadow: inset 0 0 0 2px #ffffff, 0 0 0 2px #ffffff; }
      .ring.large { border-style: dashed; }
      .label { position: fixed; display: none; min-width: 34px; height: 34px; padding: 0 8px; border-radius: 17px;
        background: #ff00ff; color: #ffffff; border: 2px solid #ffffff;
        font: 700 20px/30px system-ui, -apple-system, "Segoe UI", sans-serif; text-align: center; }
      .caption { position: fixed; left: 50%; bottom: 72px; transform: translateX(-50%); display: none;
        width: min(900px, 86vw); padding: 16px 22px; border-radius: 6px; background: #111111; color: #ffffff;
        border: 2px solid #ffffff; border-left: 8px solid #ff00ff; font: 600 26px/1.3 system-ui, -apple-system, "Segoe UI", sans-serif; }
      .caption .el { display: block; margin-top: 8px; font: 500 18px/1.3 ui-monospace, Menlo, monospace; color: #f5d0fe; }
      .caption .fact { display: block; margin-top: 6px; font-size: 19px; font-weight: 400; color: #e5e7eb; }
      .sync { position: fixed; left: 0; top: 0; width: 48px; height: 48px; display: none; }
      .caption .note { display: block; margin-top: 6px; font-size: 20px; font-weight: 500; color: #ffffff; }
      .caption .time { display: block; font-size: 18px; font-weight: 500; color: #e5e7eb; margin-bottom: 4px;
        font-variant-numeric: tabular-nums; }
    </style>
    <div class="sync"></div><div class="ring"></div><div class="label"></div>
    <div class="caption"><span class="time"></span><span class="text"></span><span class="el"></span><span class="fact"></span><span class="note"></span></div>
    <div class="chip"><span class="key"></span><span class="count"></span></div>`
  document.documentElement.appendChild(host)
  const chip = root.querySelector('.chip')
  const ring = root.querySelector('.ring')
  const label = root.querySelector('.label')
  const caption = root.querySelector('.caption')
  const sync = root.querySelector('.sync')
  let chipShown = false
  let pausedFilter = null
  let pausedCanvases = []

  window[KEY] = {
    keyChip(text, count) {
      chip.querySelector('.key').textContent = text
      chip.querySelector('.count').textContent = count ? `x ${count}` : ''
      chip.style.display = 'flex'
      chipShown = true
    },
    hideChip() { chip.style.display = 'none'; chipShown = false },
    // For the clean screenshot: hide everything, then put the chip back.
    hideAll() {
      chip.style.display = 'none'; ring.style.display = 'none'
      label.style.display = 'none'; caption.style.display = 'none'
    },
    restoreChip() { if (chipShown) chip.style.display = 'flex' },
    // A magenta ring with a white inner and outer stroke, readable on any
    // background, and a numbered label kept inside the viewport. Very large
    // elements get a dashed ring inset inside the viewport instead.
    highlight({ rect, number, large }) {
      const vw = window.innerWidth
      const vh = window.innerHeight
      const pad = 4
      let x = rect.x - pad
      let y = rect.y - pad
      let w = rect.width + pad * 2
      let h = rect.height + pad * 2
      if (large) {
        const inset = 8
        x = Math.max(inset, x)
        y = Math.max(inset, y)
        w = Math.min(vw - inset, rect.x + rect.width + pad) - x
        h = Math.min(vh - inset, rect.y + rect.height + pad) - y
      }
      ring.className = large ? 'ring large' : 'ring'
      Object.assign(ring.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px`, display: 'block' })
      label.textContent = String(number)
      label.style.display = 'block'
      const lw = label.offsetWidth || 34
      const lh = 34
      const lx = Math.min(Math.max(4, x - lw / 2), vw - lw - 4)
      const ly = y - lh - 6 >= 4 ? y - lh - 6 : Math.min(vh - lh - 4, Math.max(4, y + h + 6))
      Object.assign(label.style, { left: `${lx}px`, top: `${ly}px` })
      return { ring: { x, y, width: w, height: h }, label: { x: lx, y: ly, width: lw, height: lh } }
    },
    // note: shown under the sentence while the persona's filter is paused.
    // detail: { element, fact }, written under the sentence so the moment
    // can be understood from the video alone.
    caption(text, time, note, detail) {
      caption.querySelector('.time').textContent = time
      caption.querySelector('.text').textContent = text
      const el = caption.querySelector('.el')
      el.textContent = detail?.element ? `On: ${detail.element}` : ''
      el.style.display = detail?.element ? 'block' : 'none'
      const fact = caption.querySelector('.fact')
      fact.textContent = detail?.fact ? String(detail.fact).slice(0, 220) : ''
      fact.style.display = detail?.fact ? 'block' : 'none'
      const n = caption.querySelector('.note')
      n.textContent = note || ''
      n.style.display = note ? 'block' : 'none'
      caption.style.display = 'block'
    },
    // Video timing mark: a corner square that turns from black to white.
    // Black and white stay dark and light under every persona filter.
    syncBox(state) {
      sync.style.display = state === 'off' ? 'none' : 'block'
      sync.style.background = state === 'light' ? '#ffffff' : '#000000'
    },
    clearMoment() { ring.style.display = 'none'; label.style.display = 'none'; caption.style.display = 'none' },
    // The persona's filter sits on <html>, which would blur or tint the
    // overlay too. While a moment is captured and held, the filter is paused
    // so the evidence is clean and the caption stays readable.
    pauseFilter() {
      if (pausedFilter !== null) return
      pausedFilter = document.documentElement.style.filter
      document.documentElement.style.filter = ''
      // Conditions drawn on a canvas (tunnel vision) pause the same way.
      pausedCanvases = Array.from(document.querySelectorAll('canvas[data-accessgen="true"]')).map((c) => [c, c.style.display])
      for (const [c] of pausedCanvases) c.style.display = 'none'
    },
    resumeFilter() {
      if (pausedFilter === null) return
      document.documentElement.style.filter = pausedFilter
      pausedFilter = null
      for (const [c, display] of pausedCanvases) c.style.display = display
      pausedCanvases = []
    }
  }
}

// Calls a method on the overlay installed above.
export function overlayCall({ method, args = [] }) {
  return window[Symbol.for('accessgen.runner.overlay')]?.[method]?.(...args)
}

export function overlayKeyChip({ label, count }) {
  window[Symbol.for('accessgen.runner.overlay')]?.keyChip(label, count)
}

export function overlayHideChip() {
  window[Symbol.for('accessgen.runner.overlay')]?.hideChip()
}

// Scrolls an element into view and describes it, for evidence. Returns null
// when the selector no longer matches anything. The html is sanitised: no
// script or style content, no form values, at most 200 characters.
export function locateAndDescribe(selector) {
  let el = null
  try { el = document.querySelector(selector) } catch { return null }
  if (!el) return null
  el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' })
  const r = el.getBoundingClientRect()
  const clone = el.cloneNode(true)
  for (const n of clone.querySelectorAll('script, style')) n.textContent = ''
  for (const n of [clone, ...clone.querySelectorAll('*')]) {
    if (n.hasAttribute && n.hasAttribute('value')) n.setAttribute('value', '')
  }
  const html = clone.outerHTML.replace(/\s+/g, ' ').trim().slice(0, 200)
  const name = (el.getAttribute('aria-label') || el.getAttribute('alt') || el.getAttribute('title') ||
    el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 120)
  return {
    selector,
    role: el.getAttribute('role') || el.tagName.toLowerCase(),
    name,
    rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) },
    html,
    viewport: { width: window.innerWidth, height: window.innerHeight }
  }
}

// Applies the bundled extension profiles (see scripts/build-profiles.js).
export function applyProfiles(profiles) {
  return window[Symbol.for('accessgen.runner.profiles')]?.apply(profiles) ?? 0
}

// Where the person was just at, for conditions that follow it (tunnel vision).
export function setConditionAnchor(point) {
  window[Symbol.for('accessgen.runner.profiles')]?.anchor(point)
}

// ---------------------------------------------------------------- task mode
// Used by taskWalk (task.js). These only read the page; none of them acts.

// What the focused element says about itself, for a person who can see it
// and for one who hears it, plus the landmarks around it (nearest first)
// and the scroll position, so a stop can be placed on the page.
//   visibleText     the words on the control itself, or the label beside a field
//   accessibleName  what a screen reader announces: aria-hidden parts left out
export function describeContext() {
  let el = document.activeElement
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement
  if (!el || el === document.body || el === document.documentElement) return null

  const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, 120)
  const named = (attr, node) => (node.getAttribute(attr) || '').split(/\s+/).filter(Boolean)
    .map((id) => document.getElementById(id)).filter(Boolean)
  function spoken(node) {
    if (node.nodeType === 3) return node.nodeValue
    if (node.nodeType !== 1 || node.getAttribute('aria-hidden') === 'true') return ''
    if (node.tagName === 'IMG') return node.getAttribute('alt') || ''
    return Array.from(node.childNodes).map(spoken).join(' ')
  }
  const labelText = (node) => (node.labels ? Array.from(node.labels).map((l) => l.textContent).join(' ') : '')

  const tag = el.tagName.toLowerCase()
  const isField = tag === 'input' || tag === 'select' || tag === 'textarea'
  const type = isField ? (el.getAttribute('type') || 'text').toLowerCase() : ''
  const pressable = tag === 'input' && (type === 'submit' || type === 'button' || type === 'reset')

  const accessibleName = clean(
    named('aria-labelledby', el).map(spoken).join(' ') ||
    el.getAttribute('aria-label') ||
    (isField && !pressable ? labelText(el) : '') ||
    (tag === 'input' && type === 'image' ? el.getAttribute('alt') : '') ||
    (pressable ? el.value : '') ||
    spoken(el) ||
    el.getAttribute('title') ||
    (isField ? el.getAttribute('placeholder') : '')
  )
  const visibleText = clean(isField
    ? (pressable ? el.value : (labelText(el) || el.getAttribute('placeholder')))
    : (el.innerText || Array.from(el.querySelectorAll('img[alt]')).map((i) => i.getAttribute('alt')).join(' ')))

  const KINDS = { navigation: 'nav', main: 'main', banner: 'header', contentinfo: 'footer', complementary: 'aside', search: 'search', form: 'form', region: 'region' }
  const BY_TAG = { nav: 'nav', main: 'main', header: 'header', footer: 'footer', aside: 'aside', form: 'form' }
  const landmarks = []
  for (let n = el.parentElement; n; n = n.parentElement) {
    const role = n.getAttribute('role')
    const kind = role ? KINDS[role] : BY_TAG[n.tagName.toLowerCase()]
    if (!kind) continue
    const heading = n.querySelector('h1,h2,h3,h4,h5,h6,legend')
    landmarks.push({
      kind,
      name: clean(named('aria-labelledby', n).map(spoken).join(' ') || n.getAttribute('aria-label')),
      heading: clean(heading ? heading.innerText : '')
    })
  }
  return { accessibleName, visibleText, landmarks, scroll: { x: window.scrollX, y: window.scrollY } }
}

// Whether pressing Enter on the focused element stays inside what Task Mode
// allows: a link to a page on the same site, or a button that does not submit
// a form. Reads only; the caller presses the key.
export function describeActivation() {
  let el = document.activeElement
  while (el && el.shadowRoot && el.shadowRoot.activeElement) el = el.shadowRoot.activeElement
  if (!el) return { ok: false, why: 'nothing-focused' }
  const tag = el.tagName.toLowerCase()
  if (tag === 'button') {
    if (el.disabled) return { ok: false, why: 'disabled' }
    if (el.form && el.type !== 'button') return { ok: false, why: 'submits-form' }
    return { ok: true }
  }
  if (tag === 'a') {
    if (!el.hasAttribute('href')) return { ok: false, why: 'not-a-link' }
    let url
    try { url = new URL(el.href, location.href) } catch { return { ok: false, why: 'not-a-link' } }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false, why: 'not-a-web-link' }
    if (el.hasAttribute('download')) return { ok: false, why: 'download' }
    if ((el.getAttribute('target') || '').toLowerCase() === '_blank') return { ok: false, why: 'new-tab' }
    if (url.origin !== location.origin) return { ok: false, why: 'leaves-site' }
    return { ok: true }
  }
  return { ok: false, why: 'not-a-link-or-button' }
}

// Changes whenever the browser loads a new document, and not otherwise.
export function documentStamp() {
  return performance.timeOrigin
}
