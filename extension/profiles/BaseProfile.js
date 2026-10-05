// Base class for every simulation profile.
// Lifecycle: init() applies the simulation, update(severity) retunes it
// live, destroy() must leave the page exactly as it was found.
export class BaseProfile {
  constructor(severity = 2) {
    this.severity = severity // 1=mild, 2=moderate, 3=severe
    this.elements = []       // injected DOM nodes, removed on destroy
    this.listeners = []      // [target, type, fn, options], removed on destroy
    this.intervals = []      // interval ids
    this.rafs = []           // requestAnimationFrame ids
    this.observers = []      // MutationObservers
  }

  init() {}

  update(severity) {
    this.severity = severity
  }

  destroy() {
    for (const el of this.elements) el.remove()
    for (const [target, type, fn, options] of this.listeners) {
      target.removeEventListener(type, fn, options)
    }
    for (const id of this.intervals) clearInterval(id)
    for (const id of this.rafs) cancelAnimationFrame(id)
    for (const ob of this.observers) ob.disconnect()
    this.elements = []
    this.listeners = []
    this.intervals = []
    this.rafs = []
    this.observers = []
  }

  // ---- helpers ------------------------------------------------------

  addElement(el, parent = document.documentElement) {
    parent.appendChild(el)
    this.elements.push(el)
    return el
  }

  addListener(target, type, fn, options) {
    target.addEventListener(type, fn, options)
    this.listeners.push([target, type, fn, options])
  }

  addInterval(fn, ms) {
    const id = setInterval(fn, ms)
    this.intervals.push(id)
    return id
  }

  addObserver(observer, target, config) {
    observer.observe(target, config)
    this.observers.push(observer)
    return observer
  }

  injectStyle(css, id) {
    const style = document.createElement('style')
    if (id) style.id = id
    style.textContent = css
    return this.addElement(style, document.head || document.documentElement)
  }

  makeOverlayCanvas(zIndex = 2147483640) {
    const canvas = document.createElement('canvas')
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    canvas.style.cssText = `
      position: fixed; top: 0; left: 0;
      width: 100vw; height: 100vh;
      pointer-events: none; z-index: ${zIndex};
    `
    canvas.setAttribute('aria-hidden', 'true')
    canvas.dataset.accessgen = 'true'
    this.addElement(canvas)
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    this.addListener(window, 'resize', resize)
    return canvas
  }
}
