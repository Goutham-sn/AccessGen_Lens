// The filters each profile applies, for previews of what a profile does
// (not for recorded video, which already shows them: see getVideoFilter).

export const COLOR_MATRICES = {
  deuteranopia: [
    0.367, 0.861, -0.228, 0, 0,
    0.280, 0.673, 0.047, 0, 0,
    -0.012, 0.043, 0.969, 0, 0,
    0, 0, 0, 1, 0
  ]
}

const LOW_VISION = {
  1: 'blur(2px) brightness(0.9)',
  2: 'blur(4px) brightness(0.8)',
  3: 'blur(8px) brightness(0.7) contrast(0.8)'
}

// Build the CSS filter string for a profile combination.
export function getSimulationFilter(activeProfiles = []) {
  const parts = []
  for (const ap of activeProfiles) {
    switch (ap.id) {
      case 'deuteranopia':
        parts.push(`url(#accessgen-playback-${ap.id})`)
        break
      case 'achromatopsia':
        parts.push('grayscale(100%)')
        break
      case 'low-vision':
        parts.push(LOW_VISION[ap.severity || 2])
        break
      case 'screen-reader':
        parts.push('blur(10px)')
        break
      default:
        break
    }
  }
  return parts.join(' ') || 'none'
}

// The filter to put on a session's <video>. Every video already has the
// simulation in its pixels: runner videos, extension tab recordings
// (tabCapture) and videos built from captured frames (captureVisibleTab)
// all record what was on screen. Adding the filter again doubled it (a
// deuteranopia session played back twice as colour-blind, low vision
// blurred twice).
export function getVideoFilter() {
  return 'none'
}

// Inline SVG defs for the color-matrix filters referenced above.
export function SimulationFilterDefs() {
  return (
    <svg aria-hidden="true" style={{ position: 'absolute', width: 0, height: 0 }}>
      <defs>
        {Object.entries(COLOR_MATRICES).map(([id, matrix]) => (
          <filter id={`accessgen-playback-${id}`} key={id}>
            <feColorMatrix type="matrix" values={matrix.join(' ')} />
          </filter>
        ))}
      </defs>
    </svg>
  )
}
