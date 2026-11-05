// Contrast sensitivity loss, the part of low vision that a blur does not
// show. With low vision, strong black on white stays readable while faint
// grey text, pale borders and light placeholders fade into their
// background. Each text-bearing element's own contrast is measured, and the
// fainter it already is, the further its colour is moved toward its
// background. Strong contrast is left alone.
//
// Colours are set through data attributes and CSS custom properties, so
// one class on <html> (accessgen-paused) shows the page as it really is,
// and destroy() leaves nothing behind.

const MAX_ELEMENTS = 5000

// While colours are faded, the page's own colours are no longer what
// getComputedStyle (and so the rules engine) reads. Every text element's
// real contrast is measured here before anything is faded, and the ones
// below what they need are kept for the page audit (auditor.js).
export const contrastRegistry = { active: 0, failing: new Map() }

function hex({ r, g, b }) {
  const h = (v) => Math.round(v).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function parse(color) {
  const m = /rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/.exec(color || '')
  if (!m) return null
  let a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : parseFloat(m[4])
  if (!Number.isFinite(a)) a = 1
  return { r: +m[1], g: +m[2], b: +m[3], a }
}

function lum({ r, g, b }) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

export function ratio(a, b) {
  const la = lum(a)
  const lb = lum(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

function over(top, bottom) {
  const a = top.a
  return { r: top.r * a + bottom.r * (1 - a), g: top.g * a + bottom.g * (1 - a), b: top.b * a + bottom.b * (1 - a), a: 1 }
}

function mix(a, b, t) {
  const v = (x, y) => Math.round(x + (y - x) * t)
  return `rgb(${v(a.r, b.r)}, ${v(a.g, b.g)}, ${v(a.b, b.b)})`
}

// The colour behind an element, or null when a picture or gradient is
// behind it (then its contrast cannot be known, and it is left alone).
function backgroundOf(el) {
  const layers = []
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const cs = getComputedStyle(n)
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return null
    const c = parse(cs.backgroundColor)
    if (c && c.a > 0) {
      layers.push(c)
      if (c.a >= 1) break
    }
  }
  let bg = { r: 255, g: 255, b: 255, a: 1 }
  for (let i = layers.length - 1; i >= 0; i--) bg = over(layers[i], bg)
  return bg
}

function hasOwnText(el) {
  for (const n of el.childNodes) if (n.nodeType === 3 && n.nodeValue.trim().length > 0) return true
  return false
}

// threshold: the contrast below which things start to fade.
// maxFade: how far toward the background the faintest things move (0..1).
export function startContrastLoss({ threshold, maxFade, borderThreshold = 3 }) {
  const style = document.createElement('style')
  style.dataset.accessgen = 'true'
  style.textContent = `
    html:not(.accessgen-paused) [data-ag-faint] { color: var(--ag-faint) !important; -webkit-text-fill-color: var(--ag-faint) !important; }
    html:not(.accessgen-paused) [data-ag-faint-border] { border-color: var(--ag-faint-border) !important; }
    html:not(.accessgen-paused) [data-ag-faint-ph]::placeholder { color: var(--ag-faint-ph) !important; opacity: 1 !important; }
  `
  ;(document.head || document.documentElement).appendChild(style)
  const marked = new Set()
  const fadeFor = (r, t) => Math.min(maxFade, Math.max(0, ((t - r) / (t - 1)) * maxFade))

  function scan() {
    let n = 0
    const all = document.body ? document.body.getElementsByTagName('*') : []
    for (const el of all) {
      if (n++ > MAX_ELEMENTS) break
      if (el.closest('[data-accessgen]') || marked.has(el)) continue
      const cs = getComputedStyle(el)
      if (cs.visibility === 'hidden' || cs.display === 'none') continue
      const field = /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName)
      if (!hasOwnText(el) && !field) continue
      const bg = backgroundOf(el)
      if (!bg) continue
      const fg = parse(cs.color)
      if (fg && hasOwnText(el)) {
        const size = parseFloat(cs.fontSize) || 16
        const bold = parseInt(cs.fontWeight, 10) >= 700
        const needs = size >= 24 || (bold && size >= 18.66) ? 3 : 4.5
        const real = ratio(over(fg, bg), bg)
        if (real < needs) {
          contrastRegistry.failing.set(el, {
            fg: hex(over(fg, bg)), bg: hex(bg), ratio: Math.round(real * 100) / 100, needs,
            fontSize: `${Math.round(size)}px`, fontWeight: cs.fontWeight
          })
        }
      }
      if (fg) {
        const r = ratio(over(fg, bg), bg)
        const t = fadeFor(r, threshold)
        if (t > 0.02) {
          el.style.setProperty('--ag-faint', mix(over(fg, bg), bg, t))
          el.setAttribute('data-ag-faint', '')
          marked.add(el)
        }
      }
      if (field) {
        const bc = parse(cs.borderTopColor)
        if (bc && parseFloat(cs.borderTopWidth) > 0) {
          const parentBg = backgroundOf(el.parentElement || el) || bg
          const r = ratio(over(bc, parentBg), parentBg)
          const t = fadeFor(r, borderThreshold)
          if (t > 0.02) {
            el.style.setProperty('--ag-faint-border', mix(over(bc, parentBg), parentBg, t))
            el.setAttribute('data-ag-faint-border', '')
            marked.add(el)
          }
        }
        if (el.placeholder) {
          const pc = parse(getComputedStyle(el, '::placeholder').color)
          if (pc) {
            const r = ratio(over(pc, bg), bg)
            const t = fadeFor(r, threshold)
            if (t > 0.02) {
              el.style.setProperty('--ag-faint-ph', mix(over(pc, bg), bg, t))
              el.setAttribute('data-ag-faint-ph', '')
              marked.add(el)
            }
          }
        }
      }
    }
  }

  let timer = null
  const observer = new MutationObserver(() => {
    clearTimeout(timer)
    timer = setTimeout(scan, 800)
  })
  contrastRegistry.active += 1
  scan()
  if (document.body) observer.observe(document.body, { childList: true, subtree: true })

  return () => {
    contrastRegistry.active = Math.max(0, contrastRegistry.active - 1)
    clearTimeout(timer)
    observer.disconnect()
    for (const el of marked) {
      el.removeAttribute('data-ag-faint')
      el.removeAttribute('data-ag-faint-border')
      el.removeAttribute('data-ag-faint-ph')
      el.style.removeProperty('--ag-faint')
      el.style.removeProperty('--ag-faint-border')
      el.style.removeProperty('--ag-faint-ph')
    }
    marked.clear()
    style.remove()
  }
}
