// "45 seconds", "3 minutes". Short sessions used to read "0 minutes" or
// round up to "1 minute".
export function durationText(seconds) {
  const s = Math.max(0, Math.round(seconds || 0))
  if (s < 60) return `${s} second${s === 1 ? '' : 's'}`
  const m = Math.round(s / 60)
  return `${m} minute${m === 1 ? '' : 's'}`
}

// Moments the simulation noticed by itself (extension friction detectors).
export function isAutoMoment(m) {
  return m?.source === 'extension-auto'
}
