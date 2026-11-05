// Pure copy of pinOf (PinnedShot.jsx), for tests that cannot import JSX.
export function pinOf(rect) {
  if (!rect || !(rect.vw > 0) || !(rect.vh > 0)) return null
  const pad = 6
  const left = Math.max(0, (rect.x - pad) / rect.vw) * 100
  const top = Math.max(0, (rect.y - pad) / rect.vh) * 100
  const width = Math.min(100 - left, ((rect.width + pad * 2) / rect.vw) * 100)
  const height = Math.min(100 - top, ((rect.height + pad * 2) / rect.vh) * 100)
  if (left >= 100 || top >= 100 || width <= 0 || height <= 0) return null
  return { left, top, width, height }
}
