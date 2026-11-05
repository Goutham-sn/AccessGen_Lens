// Helpers for playing a Manual session's captured frames (FramePlayer.jsx).

export function playableFrames(frames) {
  return (frames || [])
    .filter((f) => f.frame_index > 0 && f.screenshot_url)
    .sort((a, b) => a.timestamp_ms - b.timestamp_ms)
}

// Index of the frame showing at `seconds` into the player.
export function frameAt(list, seconds) {
  if (list.length === 0) return -1
  const ms = list[0].timestamp_ms + seconds * 1000
  let lo = 0
  let hi = list.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (list[mid].timestamp_ms <= ms) lo = mid
    else hi = mid - 1
  }
  return lo
}
