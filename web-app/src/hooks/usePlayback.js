import { useCallback, useEffect, useRef, useState } from 'react'
import { api, mediaUrl } from '../services/api.js'

// Loads playback data and controls the <video> element.
export function usePlayback(sessionId) {
  const videoRef = useRef(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeedState] = useState(1)

  useEffect(() => {
    let cancelled = false
    api.get(`/playback/${sessionId}`)
      .then((d) => { if (!cancelled) setData(d) })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [sessionId])

  const videoUrl = data?.session?.video_url ? mediaUrl(data.session.video_url) : null

  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (v) setCurrentTime(v.currentTime)
  }, [])

  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current
    if (v) setDuration(v.duration)
  }, [])

  const toggle = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play(); setPlaying(true) }
    else { v.pause(); setPlaying(false) }
  }, [])

  const seekTo = useCallback((seconds) => {
    const v = videoRef.current
    if (v) {
      v.currentTime = Math.max(0, Math.min(seconds, v.duration || seconds))
      setCurrentTime(v.currentTime)
    }
  }, [])

  const setSpeed = useCallback((rate) => {
    const v = videoRef.current
    if (v) v.playbackRate = rate
    setSpeedState(rate)
  }, [])

  // Map a session timestamp (ms since session start) to a position in the
  // video. Returns null for moments logged before the recording started:
  // they have no video position.
  const sessionMsToVideoSeconds = useCallback((ms) => {
    const offset = data?.session?.recording_offset_ms
    if (offset != null) {
      const sec = (ms - offset) / 1000
      return sec < 0 ? null : sec
    }
    // Older sessions without an offset: scale session time onto the video.
    const sessionMs = (data?.session?.duration_seconds || 0) * 1000
    if (!sessionMs || !duration) return 0
    return (ms / sessionMs) * duration
  }, [data, duration])

  return {
    videoRef, data, error, videoUrl,
    playing, currentTime, duration, speed,
    toggle, seekTo, setSpeed, setPlaying,
    onTimeUpdate, onLoadedMetadata,
    sessionMsToVideoSeconds
  }
}
