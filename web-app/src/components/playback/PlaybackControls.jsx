import { useEffect } from 'react'
import { Button } from '../shared/Button.jsx'

const SPEEDS = [0.5, 1, 2]

export function PlaybackControls({
  playing, toggle, speed, setSpeed,
  empathyMoments, currentTime, sessionMsToVideoSeconds, onSeek, onShare
}) {
  // Space toggles play/pause when focus isn't inside a form control.
  useEffect(() => {
    function onKey(e) {
      if (e.code !== 'Space') return
      const tag = document.activeElement?.tagName
      if (['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(tag)) return
      e.preventDefault()
      toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle])

  const momentTimes = empathyMoments
    .map((m) => sessionMsToVideoSeconds(m.timestamp_ms))
    .filter((t) => t != null)
    .sort((a, b) => a - b)

  function prevMoment() {
    const before = momentTimes.filter((t) => t < currentTime - 1)
    onSeek(before.length ? before[before.length - 1] : 0)
  }

  function nextMoment() {
    const after = momentTimes.filter((t) => t > currentTime + 1)
    if (after.length) onSeek(after[0])
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button onClick={toggle} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '❚❚ Pause' : '▶ Play'}
      </Button>
      <Button variant="secondary" onClick={prevMoment} disabled={momentTimes.length === 0}>
        ← Previous moment
      </Button>
      <Button variant="secondary" onClick={nextMoment} disabled={momentTimes.length === 0}>
        Next moment →
      </Button>

      <div role="radiogroup" aria-label="Playback speed" className="inline-flex rounded-lg border border-rule overflow-hidden ml-auto">
        {SPEEDS.map((s, i) => (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={speed === s}
            onClick={() => setSpeed(s)}
            className={`px-3 py-2 text-sm font-medium min-h-[40px]
              ${speed === s ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 hover:bg-paper'}
              ${i < SPEEDS.length - 1 ? 'border-r border-rule' : ''}`}
          >
            {s}×
          </button>
        ))}
      </div>

      <Button variant="secondary" onClick={onShare}>Share</Button>
    </div>
  )
}
