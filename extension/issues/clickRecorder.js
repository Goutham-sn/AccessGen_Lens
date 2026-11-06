// Runs in the page's own world, before the page's scripts where it can:
// notes which elements get mouse listeners. On the 'accessgen-mark-clickable'
// event it marks every element with a click handler of any kind (a listener,
// an onclick, a React, Vue, Angular or jQuery handler) with the attribute
// data-accessgen-clickable, so findTabSkipped (tabSkipped.js), which may run
// in another world as the extension's does, can see them. The scan removes
// the marks again straight away.
//
// Self-contained: the runner passes the function to context.addInitScript,
// the extension to chrome.scripting.executeScript with world 'MAIN'. A file
// of its own, so the extension's service worker and its content scripts do
// not share a module (each is bundled on its own).

export function installClickRecorder() {
  const KEY = Symbol.for('accessgen.clickRecorder')
  if (window[KEY]) return
  window[KEY] = true
  const ATTR = 'data-accessgen-clickable'
  const TYPES = new Set(['click', 'dblclick', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend'])
  const withListener = new WeakSet()
  try {
    const proto = EventTarget.prototype
    const original = proto.addEventListener
    const wrapped = function addEventListener(type, listener, options) {
      try {
        if (listener && TYPES.has(type) && this && this.nodeType === 1) withListener.add(this)
      } catch { /* never in the page's way */ }
      return original.call(this, type, listener, options)
    }
    Object.defineProperty(wrapped, 'toString', { value: () => original.toString(), configurable: true })
    proto.addEventListener = wrapped
  } catch { /* a page that froze EventTarget: framework props still work */ }

  const REACT = ['onClick', 'onClickCapture', 'onMouseDown', 'onMouseUp', 'onPointerDown', 'onPointerUp', 'onTouchStart', 'onTouchEnd', 'onDoubleClick']
  const VUE = ['onClick', 'onMousedown', 'onMouseup', 'onPointerdown', 'onPointerup', 'onTouchstart', 'onDblclick']
  function hasHandler(el) {
    if (withListener.has(el)) return true
    if (typeof el.onclick === 'function' || typeof el.onmousedown === 'function' || typeof el.onpointerdown === 'function' ||
        typeof el.onmouseup === 'function' || typeof el.ontouchstart === 'function') return true
    for (const k of Object.keys(el)) {
      if (k.startsWith('__reactProps$') || k.startsWith('__reactEventHandlers$')) {
        const p = el[k]
        if (p && REACT.some((n) => typeof p[n] === 'function')) return true
      } else if (k === '_vei') {
        const v = el._vei
        if (v && VUE.some((n) => v[n])) return true
      } else if (k.startsWith('__zone_symbol__') && /click|mousedown|pointerdown|touchstart/i.test(k)) {
        return true
      }
    }
    try {
      const jq = window.jQuery || window.$
      const ev = jq && jq._data && jq._data(el, 'events')
      if (ev && (ev.click || ev.mousedown || ev.mouseup || ev.touchstart)) return true
    } catch { /* not jQuery */ }
    return false
  }

  document.addEventListener('accessgen-mark-clickable', () => {
    const all = document.querySelectorAll('body *')
    for (let i = 0; i < all.length && i < 30000; i++) {
      if (hasHandler(all[i])) all[i].setAttribute(ATTR, '')
    }
  }, true)
}

