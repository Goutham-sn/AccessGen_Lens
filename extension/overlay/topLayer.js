// Puts an AccessGen UI element (control panel, screen reader caption bar)
// into the browser's top layer with the Popover API.
//
// Why: the vision profiles filter the whole page through
// document.documentElement.style.filter (blur, colour matrix, greyscale).
// A filter on <html> applies to every descendant, so the control panel and
// the screen reader's caption bar were blurred along with the page and could
// not be read. Elements in the top layer are painted outside the root
// element's box, so the root filter does not reach them, and they sit above
// every z-index the page uses.

const RESET = {
  position: 'fixed',
  margin: '0',
  padding: '0',
  border: '0',
  background: 'transparent',
  overflow: 'visible',
  color: 'inherit',
  inset: 'auto',
  width: 'auto',
  height: 'auto',
  'max-width': 'none',
  'max-height': 'none',
  filter: 'none',
  transform: 'none',
  opacity: '1',
  visibility: 'visible',
  'pointer-events': 'auto'
}

export function styleHost(el, extra = {}) {
  for (const [prop, value] of Object.entries({ ...RESET, ...extra })) {
    el.style.setProperty(prop, value, 'important')
  }
}

// Appends el to <html> and promotes it to the top layer. Falls back to a
// plain high z-index element where the Popover API is missing.
export function mountTopLayer(el) {
  if (!el.isConnected) document.documentElement.appendChild(el)
  try {
    if (typeof el.showPopover === 'function') {
      el.setAttribute('popover', 'manual')
      if (!el.matches(':popover-open')) el.showPopover()
      return true
    }
  } catch {
    // Not supported, or the element is in a state that refuses it.
  }
  el.style.setProperty('z-index', '2147483647', 'important')
  return false
}

// The page can open its own popovers or modal dialogs above ours. Re-raise
// ours whenever that happens, so the panel stays reachable.
export function keepOnTop(el) {
  const raise = () => {
    if (!el.isConnected || typeof el.hidePopover !== 'function') return
    try {
      if (el.matches(':popover-open')) el.hidePopover()
      el.showPopover()
    } catch { /* ignore */ }
  }
  const onToggle = (e) => {
    if (e.target !== el && e.newState === 'open') raise()
  }
  document.addEventListener('toggle', onToggle, true)
  return () => document.removeEventListener('toggle', onToggle, true)
}
