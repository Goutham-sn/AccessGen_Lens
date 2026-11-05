// The two-run mission: as yourself first, then as the person. The second
// run is described here between the two, in this tab only, so the
// step-in page can start it after the first one ends.
const KEY = 'accessgen.mission-chain.v1'

export function saveChain(chain) {
  try { sessionStorage.setItem(KEY, JSON.stringify(chain)) } catch { /* private mode: no chain */ }
}

export function loadChain() {
  try {
    const c = JSON.parse(sessionStorage.getItem(KEY) || 'null')
    return c && typeof c === 'object' && c.baselineSessionId && c.mission?.goal ? c : null
  } catch {
    return null
  }
}

export function clearChain() {
  try { sessionStorage.removeItem(KEY) } catch { /* nothing kept */ }
}

export function formatMs(ms) {
  if (ms == null) return null
  const s = ms / 1000
  if (s < 10) return `${s.toFixed(1)} s`
  if (s < 60) return `${Math.round(s)} s`
  const m = Math.floor(s / 60)
  return `${m} min ${Math.round(s % 60)} s`
}
