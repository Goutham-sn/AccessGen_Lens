import { useEffect, useMemo, useRef, useState } from 'react'
import { mediaUrl } from '../../services/api.js'
import { playableFrames, frameAt } from '../../utils/frames.js'

export { playableFrames }

// Plays a Manual session's captured frames (real screen pictures, about one
// every 0.7 s) when there is no video file: the backend could not build one
// (no ffmpeg in its image) or has not finished yet. Each frame stays on
// screen for as long as it did in the session.
//
// It hands videoRef a small object with the parts of the <video> API that
// usePlayback and the controls use (currentTime, duration, paused, play,
// pause, playbackRate), so the timeline, moment markers and speed buttons
// work the same as for a real video.

const PRELOAD_AHEAD = 8

export function FramePlayer({ frames, videoRef, onTimeUpdate, onLoadedMetadata, onEnded, controls = false, label, className = '' }) {
  const list = useMemo(() => playableFrames(frames), [frames])
  const duration = list.length ? (list[list.length - 1].timestamp_ms - list[0].timestamp_ms) / 1000 + 0.7 : 0
  const [time, setTime] = useState(0)
  const [paused, setPaused] = useState(true)
  const state = useRef({ time: 0, paused: true, rate: 1, raf: null, last: 0 })
  const callbacks = useRef({})
  callbacks.current = { onTimeUpdate, onEnded }

  // The video-like handle.
  const handle = useMemo(() => {
    const s = state.current
    const tick = (now) => {
      if (s.paused) return
      s.time = Math.min(duration, s.time + ((now - s.last) / 1000) * s.rate)
      s.last = now
      setTime(s.time)
      callbacks.current.onTimeUpdate?.()
      if (s.time >= duration) {
        s.paused = true
        setPaused(true)
        callbacks.current.onEnded?.()
        return
      }
      s.raf = requestAnimationFrame(tick)
    }
    return {
      get currentTime() { return s.time },
      set currentTime(v) { s.time = Math.max(0, Math.min(duration, v)); setTime(s.time); callbacks.current.onTimeUpdate?.() },
      get duration() { return duration },
      get paused() { return s.paused },
      get playbackRate() { return s.rate },
      set playbackRate(v) { s.rate = v },
      play() {
        if (!s.paused) return Promise.resolve()
        if (s.time >= duration) s.time = 0
        s.paused = false
        setPaused(false)
        s.last = performance.now()
        s.raf = requestAnimationFrame(tick)
        return Promise.resolve()
      },
      pause() {
        s.paused = true
        setPaused(true)
        cancelAnimationFrame(s.raf)
      }
    }
  }, [duration])

  useEffect(() => {
    if (videoRef) videoRef.current = handle
    onLoadedMetadata?.()
    return () => {
      handle.pause()
      if (videoRef && videoRef.current === handle) videoRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handle])

  const index = frameAt(list, time)

  // Warm the cache for the frames coming up next.
  useEffect(() => {
    for (let i = index + 1; i <= index + PRELOAD_AHEAD && i < list.length; i++) {
      const img = new Image()
      img.src = mediaUrl(list[i].screenshot_url)
    }
  }, [index, list])

  if (list.length === 0) return null
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-xl bg-black">
        <img
          src={mediaUrl(list[Math.max(0, index)].screenshot_url)}
          alt={label || 'Session recording'}
          className="block w-full"
        />
        <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
          Recorded frame by frame
        </span>
      </div>
      {controls && (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => (paused ? handle.play() : handle.pause())}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            {paused ? 'Play' : 'Pause'}
          </button>
          <input
            type="range"
            min={0}
            max={duration}
            step={0.1}
            value={time}
            onChange={(e) => { handle.currentTime = Number(e.target.value) }}
            aria-label="Playback position"
            aria-valuetext={`${fmt(time)} of ${fmt(duration)}`}
            className="flex-1"
          />
          <span className="text-xs tabular-nums text-ink-600">{fmt(time)} / {fmt(duration)}</span>
        </div>
      )}
    </div>
  )
}
