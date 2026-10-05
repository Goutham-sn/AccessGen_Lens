import { useRef } from 'react'
import { EmpathyMarker } from './EmpathyMarker.jsx'

function fmt(s) {
  const m = Math.floor(s / 60)
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

// Scrubbable timeline. Also a keyboard slider (arrow keys seek ±5s).
export function Timeline({ currentTime, duration, empathyMoments, sessionMsToVideoSeconds, onSeek }) {
  const trackRef = useRef(null)
  const pct = duration ? (currentTime / duration) * 100 : 0

  function seekFromPointer(e) {
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    onSeek(ratio * duration)
  }

  function onKeyDown(e) {
    if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(Math.min(duration, currentTime + 5)) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); onSeek(Math.max(0, currentTime - 5)) }
    if (e.key === 'Home') { e.preventDefault(); onSeek(0) }
    if (e.key === 'End') { e.preventDefault(); onSeek(duration) }
  }

  return (
    <div className="mt-6 mb-2">
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(currentTime)}
        aria-valuetext={`${fmt(currentTime)} of ${fmt(duration)}`}
        onClick={seekFromPointer}
        onKeyDown={onKeyDown}
        className="relative h-3 w-full cursor-pointer rounded-full bg-gray-200"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-brand-600"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
        <div
          aria-hidden="true"
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-5 w-5 rounded-full bg-white border-2 border-brand-700 shadow"
          style={{ left: `${pct}%` }}
        />
        {empathyMoments.map((m) => {
          const sec = sessionMsToVideoSeconds(m.timestamp_ms)
          if (sec == null) return null // logged before recording started
          const posPct = duration ? (sec / duration) * 100 : 0
          return (
            <EmpathyMarker
              key={m.id}
              moment={m}
              positionPercent={posPct}
              current={Math.abs(currentTime - sec) < 1.5}
              onJump={() => onSeek(sec)}
            />
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-xs text-ink-600 tabular-nums">
        <span>{fmt(currentTime)}</span>
        <span>{fmt(duration)}</span>
      </div>
    </div>
  )
}
