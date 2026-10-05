// The one owner of document.documentElement.style.filter for every profile
// that filters the whole page. Each profile registers its own filter and the
// inline value is rebuilt from the page's own filter plus every layer still
// registered. Profiles used to snapshot the value at init and restore that
// snapshot on destroy, so removing one could wipe another that was still on.

const layers = new Map() // owner -> filter, in the order each was first set
let pageFilter = ''      // the page's own inline filter, from before our first layer

function render() {
  const root = document.documentElement
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
