import { BaseProfile } from '../BaseProfile.js'

// What reading can feel like with dyslexia: letters inside words shift
// places, look-alike letters flip (b/d, p/q), and the words you just read
// rearrange themselves when you look back.
//
// The previous version applied dyslexia-friendly typography (OpenDyslexic,
// wide spacing, a reading guide). That is an assistive tool: it made the
// page easier to read, the opposite of what a simulation is for.
//
// Every change is undone on destroy, and only text nodes still holding the
// value this profile wrote are touched, so page scripts that rewrite text
// keep their own content.

const SETTINGS = {
  1: { intervalMs: 1400, share: 0.08 },
  2: { intervalMs: 900, share: 0.16 },
  3: { intervalMs: 550, share: 0.28 }
}
const MIRROR = { b: 'd', d: 'b', p: 'q', q: 'p', m: 'w', w: 'm', n: 'u', u: 'n' }
const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|INPUT|SELECT|OPTION|CODE|PRE|SVG|CANVAS|IFRAME)$/
const MAX_NODES_PER_TICK = 120

function scrambleWord(word, share) {
  if (word.length < 4 || Math.random() > share * 2.2) return word
  const chars = word.split('')
  // Swap two neighbouring letters inside the word (keep first and last).
  const i = 1 + Math.floor(Math.random() * (chars.length - 3))
  ;[chars[i], chars[i + 1]] = [chars[i + 1], chars[i]]
  // Sometimes a look-alike letter flips.
  if (Math.random() < 0.35) {
    const j = Math.floor(Math.random() * chars.length)
    const m = MIRROR[chars[j]]
    if (m) chars[j] = m
  }
  return chars.join('')
}

export class Dyslexia extends BaseProfile {
  init() {
    this.originals = new Map() // text node -> { original, written }
    this.restart()
  }

  restart() {
    for (const id of this.intervals) clearInterval(id)
    this.intervals = []
    this.addInterval(() => this.tick(), SETTINGS[this.severity].intervalMs)
  }

  visibleTextNodes() {
    const nodes = []
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.nodeValue || node.nodeValue.trim().length < 4) return NodeFilter.FILTER_REJECT
        const parent = node.parentElement
        if (!parent || SKIP.test(parent.tagName) || parent.isContentEditable ||
            parent.closest('[data-accessgen]')) return NodeFilter.FILTER_REJECT
        return NodeFilter.FILTER_ACCEPT
      }
    })
    const vh = window.innerHeight
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const r = node.parentElement.getBoundingClientRect()
      if (r.bottom < 0 || r.top > vh || r.width === 0) continue
      nodes.push(node)
      if (nodes.length >= MAX_NODES_PER_TICK) break
    }
    return nodes
  }

  tick() {
    const { share } = SETTINGS[this.severity]
    for (const node of this.visibleTextNodes()) {
      let entry = this.originals.get(node)
      // The page changed this text itself: adopt its new value as the original.
      if (entry && node.nodeValue !== entry.written) entry = null
      if (!entry) entry = { original: node.nodeValue, written: node.nodeValue }
      const next = entry.original.replace(/[A-Za-z]{4,}/g, (w) => scrambleWord(w, share))
      if (next !== node.nodeValue) node.nodeValue = next
      entry.written = next
      this.originals.set(node, entry)
    }
  }

  update(severity) {
    super.update(severity)
    this.restart()
  }

  destroy() {
    for (const [node, entry] of this.originals) {
      if (node.isConnected && node.nodeValue === entry.written) node.nodeValue = entry.original
    }
    this.originals.clear()
    super.destroy()
  }
}
