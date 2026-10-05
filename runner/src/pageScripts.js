// Functions that run inside the page via page.evaluate. Each one must be
// self-contained: Playwright serializes it, so no outside variables.

// Resolves once the DOM has gone quietMs without a mutation, or after capMs.
export function waitForDomQuiet({ quietMs, capMs }) {
  return new Promise((resolve) => {
    let timer = setTimeout(done, quietMs)
    const cap = setTimeout(done, capMs)
    const obs = new MutationObserver(() => {
      clearTimeout(timer)
      timer = setTimeout(done, quietMs)
    })
    obs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true })
    function done() {
      obs.disconnect()
      clearTimeout(timer)
      clearTimeout(cap)
      resolve()
    }
  })
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

  return {
    kind: el.tagName === 'IFRAME' || el.tagName === 'FRAME' ? 'frame' : 'element',
    selector: selectorFor(el),
    name,
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role'),
    rect: { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }
  }
}

// A CAPTCHA or bot wall. We never try to get around one.
export function detectChallenge() {
  const title = (document.title || '').toLowerCase()
  const frameHit = Array.from(document.querySelectorAll('iframe')).some((f) =>
    /recaptcha|hcaptcha\.com|challenges\.cloudflare\.com|turnstile|arkoselabs|funcaptcha/i.test(f.src || ''))
  const markerHit = Boolean(document.querySelector(
    '#challenge-form, #challenge-running, [id^="cf-chl"], .cf-turnstile, .g-recaptcha, .h-captcha, #px-captcha'
  ))
  const titleHit = /just a moment|attention required|verify you are human|are you a robot|access denied|security check/.test(title)
  if (frameHit || markerHit) return 'challenge'
  if (titleHit) return 'challenge-title'
  return null
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
      .caption { position: fixed; left: 50%; bottom: 96px; transform: translateX(-50%); display: none;
        max-width: 80vw; padding: 14px 22px; border-radius: 12px; background: #111827; color: #ffffff;
        border: 2px solid #ffffff; font: 600 28px/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; }
      .sync { position: fixed; left: 0; top: 0; width: 48px; height: 48px; display: none; }
      .caption .time { display: block; font-size: 18px; font-weight: 500; color: #e5e7eb; margin-bottom: 4px;
        font-variant-numeric: tabular-nums; }
    </style>
    <div class="sync"></div><div class="ring"></div><div class="label"></div>
    <div class="caption"><span class="time"></span><span class="text"></span></div>
    <div class="chip"><span class="key"></span><span class="count"></span></div>`
  document.documentElement.appendChild(host)
  const chip = root.querySelector('.chip')
  const ring = root.querySelector('.ring')
  const label = root.querySelector('.label')
  const caption = root.querySelector('.caption')
  const sync = root.querySelector('.sync')
  let chipShown = false
  let pausedFilter = null

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
    caption(text, time) {
      caption.querySelector('.time').textContent = time
      caption.querySelector('.text').textContent = text
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
    },
    resumeFilter() {
      if (pausedFilter === null) return
      document.documentElement.style.filter = pausedFilter
      pausedFilter = null
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
