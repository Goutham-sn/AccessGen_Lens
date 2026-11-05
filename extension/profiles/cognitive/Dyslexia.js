import { BaseProfile } from '../BaseProfile.js'

// Reading with dyslexia is not seeing a page of letters dancing. It is
// effort where you are reading: the words on the line you are working on
// will not hold still, look-alike letters (b/d, p/q) get swapped, the
// letters inside a long word lose their order, and a word only settles
// once you have stayed on it a while. Text you are not reading is just
// text. The reading place is the pointer, or keyboard focus.
//
// Every change is undone on destroy, and only text nodes that still hold
// the value written here are touched, so page scripts keep their own text.

const SETTINGS = {
  1: { tickMs: 900, share: 0.25, settleMs: 900, band: 1.2 },
  2: { tickMs: 650, share: 0.45, settleMs: 1500, band: 1.8 },
  3: { tickMs: 450, share: 0.7, settleMs: 2400, band: 2.6 }
}
const MIRROR = { b: 'd', d: 'b', p: 'q', q: 'p', n: 'u', u: 'n', m: 'w', w: 'm' }
const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION|CODE|PRE|SVG|CANVAS|IFRAME)$/

function scramble(word, share) {
  if (word.length < 4 || Math.random() > share) return word
  const c = word.split('')
  const i = 1 + Math.floor(Math.random() * (c.length - 3))
  ;[c[i], c[i + 1]] = [c[i + 1], c[i]]
  if (c.length > 6 && Math.random() < 0.4) {
    const j = 1 + Math.floor(Math.random() * (c.length - 3))
    ;[c[j], c[j + 1]] = [c[j + 1], c[j]]
  }
  if (Math.random() < 0.35) {
    const k = Math.floor(Math.random() * c.length)
    if (MIRROR[c[k]]) c[k] = MIRROR[c[k]]
  }
  return c.join('')
}

export class Dyslexia extends BaseProfile {
  init() {
    this.originals = new Map() // text node -> { original, written }
    this.x = window.innerWidth / 2
    this.y = window.innerHeight / 3
    this.stillSince = performance.now()
    this.addListener(window, 'mousemove', (e) => {
      if (Math.hypot(e.clientX - this.x, e.clientY - this.y) > 6) this.stillSince = performance.now()
      this.x = e.clientX
      this.y = e.clientY
    }, { capture: true, passive: true })
    this.addListener(document, 'focusin', (e) => {
      const r = e.target?.getBoundingClientRect?.()
      if (!r || (r.width === 0 && r.height === 0)) return
      this.x = r.left + Math.min(r.width / 2, 200)
      this.y = r.top + r.height / 2
      this.stillSince = performance.now()
    }, { capture: true })
    this.restart()
  }

  restart() {
    for (const id of this.intervals) clearInterval(id)
    this.intervals = []
    this.addInterval(() => this.tick(), (SETTINGS[this.severity] || SETTINGS[2]).tickMs)
  }

  // Text nodes on the lines around the reading place.
  nodesNearReading(bandLines) {
    const out = []
    const el = document.elementFromPoint(this.x, this.y)
    const lineHeight = el ? parseFloat(getComputedStyle(el).lineHeight) || 22 : 22
    const top = this.y - lineHeight * bandLines
    const bottom = this.y + lineHeight * bandLines
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.trim().length < 4) return NodeFilter.FILTER_REJECT
        const p = node.parentElement
        if (!p || SKIP.test(p.tagName) || p.isContentEditable || p.closest('[data-accessgen]')) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      }
    })
    const range = document.createRange()
    for (let node = walker.nextNode(); node && out.length < 60; node = walker.nextNode()) {
      range.selectNodeContents(node)
      for (const r of range.getClientRects()) {
        if (r.bottom >= top && r.top <= bottom && r.right >= this.x - 700 && r.left <= this.x + 700) { out.push(node); break }
      }
    }
    return out
  }

  restore(node, entry) {
    if (node.isConnected && node.nodeValue === entry.written) node.nodeValue = entry.original
    entry.written = entry.original
  }

  tick() {
    const s = SETTINGS[this.severity] || SETTINGS[2]
    const near = new Set(this.nodesNearReading(s.band))
    // Words you have left settle back.
    for (const [node, entry] of this.originals) {
      if (!near.has(node)) this.restore(node, entry)
    }
    // Staying on the same place long enough: the words resolve.
    const settled = performance.now() - this.stillSince > s.settleMs
    for (const node of near) {
      let entry = this.originals.get(node)
      if (entry && node.nodeValue !== entry.written) entry = null // the page changed it
      if (!entry) entry = { original: node.nodeValue, written: node.nodeValue }
      this.originals.set(node, entry)
      if (settled) { this.restore(node, entry); continue }
      const next = entry.original.replace(/[A-Za-z]{4,}/g, (w) => scramble(w, s.share))
      if (next !== node.nodeValue) node.nodeValue = next
      entry.written = next
    }
  }

  update(severity) {
    super.update(severity)
    this.restart()
  }

  destroy() {
    for (const [node, entry] of this.originals) this.restore(node, entry)
    this.originals.clear()
    super.destroy()
  }
}
