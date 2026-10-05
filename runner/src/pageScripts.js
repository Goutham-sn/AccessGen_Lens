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

// Video-only overlay: a key chip with a running count. Fixed position,
// pointer-events none, aria-hidden, inside a closed shadow root, so it
// cannot take focus, change layout, or show up in the accessibility tree.
export function installOverlay() {
  const KEY = Symbol.for('accessgen.runner.overlay')
  if (window[KEY]) return
  const host = document.createElement('accessgen-runner-overlay')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483647;display:block;'
  const root = host.attachShadow({ mode: 'closed' })
  root.innerHTML = `
    <style>
      .chip { position: fixed; right: 24px; bottom: 24px; display: none; align-items: center; gap: 10px;
        font: 600 22px/1 system-ui, -apple-system, "Segoe UI", sans-serif; color: #fff;
        background: rgba(17, 24, 39, 0.92); border: 2px solid #fff; border-radius: 12px; padding: 10px 14px; }
      .key { background: #fff; color: #111827; border-radius: 6px; padding: 6px 10px; }
      .count { font-variant-numeric: tabular-nums; }
    </style>
    <div class="chip"><span class="key"></span><span class="count"></span></div>`
  document.documentElement.appendChild(host)
  const chip = root.querySelector('.chip')
  window[KEY] = {
    keyChip(label, count) {
      chip.querySelector('.key').textContent = label
      chip.querySelector('.count').textContent = count ? `x ${count}` : ''
      chip.style.display = 'flex'
    },
    hideChip() { chip.style.display = 'none' }
  }
}

export function overlayKeyChip({ label, count }) {
  window[Symbol.for('accessgen.runner.overlay')]?.keyChip(label, count)
}

export function overlayHideChip() {
  window[Symbol.for('accessgen.runner.overlay')]?.hideChip()
}

// Applies the bundled extension profiles (see scripts/build-profiles.js).
export function applyProfiles(profiles) {
  return window[Symbol.for('accessgen.runner.profiles')]?.apply(profiles) ?? 0
}
