// The one owner of document.documentElement.style.filter for every profile
// that filters the whole page. Each profile registers its own filter and the
// inline value is rebuilt from the page's own filter plus every layer still
// registered. Profiles used to snapshot the value at init and restore that
// snapshot on destroy, so removing one could wipe another that was still on.

const layers = new Map() // owner -> filter, in the order each was first set
let pageFilter = ''      // the page's own inline filter, from before our first layer

let paused = false

function render() {
  const root = document.documentElement
  if (paused && layers.size) { root.style.filter = pageFilter; return }
  if (layers.size === 0) {
    root.style.filter = pageFilter
    pageFilter = ''
    return
  }
  root.style.filter = [pageFilter, ...layers.values()].filter(Boolean).join(' ')
}

export function setPageFilter(owner, filter) {
  if (layers.size === 0) pageFilter = document.documentElement.style.filter
  layers.set(owner, filter)
  render()
}

export function clearPageFilter(owner) {
  if (!layers.delete(owner)) return
  render()
}

// "Show me where": the page as it really is for a few seconds, with every
// condition's filter, overlay and faded colour lifted, then back again.
export function pauseSimulation() {
  paused = true
  render()
  document.documentElement.classList.add('accessgen-paused')
  for (const el of document.querySelectorAll('[data-accessgen]:not([data-accessgen-panel])')) {
    if (el.tagName === 'STYLE' || el.dataset.accessgenKeep) continue
    el.dataset.accessgenWasVisibility = el.style.visibility || ''
    el.style.setProperty('visibility', 'hidden', 'important')
  }
}

export function resumeSimulation() {
  paused = false
  render()
  document.documentElement.classList.remove('accessgen-paused')
  for (const el of document.querySelectorAll('[data-accessgen-was-visibility]')) {
    const v = el.dataset.accessgenWasVisibility
    delete el.dataset.accessgenWasVisibility
    if (v) el.style.setProperty('visibility', v)
    else el.style.removeProperty('visibility')
  }
}
