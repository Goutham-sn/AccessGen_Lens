// Moments come from three places: the tester ("I felt this"), the
// simulation itself while the tester explored (friction.js in the
// extension, source 'extension-auto'), and the automated runner.
export function isAutoMoment(m) {
  return m?.source === 'extension-auto'
}

// A tester's own words are quoted; what the simulation noticed is not.
export function momentTitle(m) {
  if (!m) return ''
  return isAutoMoment(m) || m.source === 'runner' ? m.label : `"${m.label}"`
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.round(seconds || 0))
  if (s < 60) return `${s} second${s === 1 ? '' : 's'}`
  const m = Math.round(s / 60)
  return `${m} minute${m === 1 ? '' : 's'}`
}

export function fmtClock(ms) {
  const s = Math.max(0, Math.floor((ms || 0) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
