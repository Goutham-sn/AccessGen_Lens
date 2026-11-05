// Struggles the simulation notices on its own while the tester explores:
// a tremor click that landed on the wrong thing, a control a screen reader
// user would hear as just "button", focus that vanished, a video with no
// captions. Each becomes an automatic moment on the report, next to the
// ones the tester logs with "I felt this", so the report says what was hard
// even when the tester forgot to press the button.
//
// Profiles call reportFriction(); the recorder listens for the window event
// and uploads the moment with a picture; the controller shows it on the panel.

const PER_KIND_LIMIT = 12       // per page load, so one broken pattern cannot flood the report
// Kinds that repeat for every element of one broken pattern (a site that
// removes every focus outline): a few examples say it, more is noise.
const KIND_LIMITS = { 'keyboard-no-focus-ring': 3, 'keyboard-focus-hidden': 3, 'keyboard-focus-covered': 3, 'sr-unnamed-focus': 4, 'tremor-missed': 6, 'tremor-wrong-target': 6 }
const SAME_TARGET_COOLDOWN_MS = 20000

function getState() {
  if (!globalThis.__accessgenFriction) {
    globalThis.__accessgenFriction = { perKind: new Map(), lastByKey: new Map() }
  }
  return globalThis.__accessgenFriction
}

// A short, human description of an element, for the moment text.
export function describeElement(el) {
  if (!el || el.nodeType !== 1) return 'something on the page'
  const text = (el.getAttribute('aria-label') || el.innerText || el.textContent || el.getAttribute('alt') ||
    el.getAttribute('title') || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim()
  const tag = el.tagName.toLowerCase()
  const kind = tag === 'a' ? 'link' : tag === 'button' || el.getAttribute('role') === 'button' ? 'button'
    : ['input', 'select', 'textarea'].includes(tag) ? 'field' : tag === 'img' ? 'image' : tag === 'video' ? 'video' : 'element'
  return text ? `the ${kind} "${text.slice(0, 50)}${text.length > 50 ? '…' : ''}"` : `an unnamed ${kind}`
}

function targetKey(el) {
  if (!el || el.nodeType !== 1) return ''
  if (el.id) return `#${el.id}`
  const parts = []
  let node = el
  for (let i = 0; node && node.nodeType === 1 && i < 5; i++) {
    const parent = node.parentElement
    const index = parent ? Array.prototype.indexOf.call(parent.children, node) : 0
    parts.unshift(`${node.tagName}:${index}`)
    node = parent
  }
  return parts.join('>')
}

// kind:      stable id of the detector, e.g. 'tremor-misclick'
// profileId: the profile that noticed it
// headline:  one short sentence in plain words ("Your click landed on ...")
// detail:    optional longer text, what a person living with it would feel
// target:    optional element, used for de-duplication and the highlight box
export function reportFriction({ kind, profileId, headline, detail = null, target = null }) {
  const state = getState()
  const count = state.perKind.get(kind) || 0
  if (count >= (KIND_LIMITS[kind] ?? PER_KIND_LIMIT)) return false
  const key = `${kind}|${targetKey(target)}`
  const now = Date.now()
  if (target && now - (state.lastByKey.get(key) || 0) < SAME_TARGET_COOLDOWN_MS) return false
  state.lastByKey.set(key, now)
  state.perKind.set(kind, count + 1)

  let rect = null
  if (target?.getBoundingClientRect) {
    const r = target.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) {
      rect = { x: Math.round(r.left), y: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) }
    }
  }
  window.dispatchEvent(new CustomEvent('accessgen-friction', {
    detail: { kind, profileId, headline, detail, rect, url: location.href }
  }))
  return true
}
