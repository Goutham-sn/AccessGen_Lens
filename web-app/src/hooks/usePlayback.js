import { useCallback, useEffect, useRef, useState } from 'react'
import { api, mediaUrl } from '../services/api.js'

const POLL_MS = 4000
const POLL_LIMIT_MS = 5 * 60 * 1000

// Loads playback data and controls the <video> element.
export function usePlayback(sessionId) {
  const videoRef = useRef(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  // True while video_url is still empty and the 5 minute limit has not run
  // out. The recording is uploaded after the session ends, sometimes after
  // the backend has already given up on it, so the status alone can't say
  // whether a video is still coming.
  const [waitingForVideo, setWaitingForVideo] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeedState] = useState(1)

  useEffect(() => {
    let cancelled = false
    let timer = null
    let loaded = false
    const startedAt = Date.now()
    setWaitingForVideo(true)

    const pollAgain = () => {
      if (Date.now() - startedAt < POLL_LIMIT_MS) timer = setTimeout(load, POLL_MS)
      else setWaitingForVideo(false)
    }

    function load() {
      api.get(`/playback/${sessionId}`)
        .then((d) => {
          if (cancelled) return
          loaded = true
          setData(d)
          if (d.session?.video_url) setWaitingForVideo(false)
          else pollAgain()
        })
        .catch((e) => {
          if (cancelled) return
          // A failed poll keeps what is already on screen and tries again.
          if (loaded) pollAgain()
          else { setError(e.message); setWaitingForVideo(false) }
        })
    }

    load()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [sessionId])

  const videoUrl = data?.session?.video_url ? mediaUrl(data.session.video_url) : null

  const onTimeUpdate = useCallback(() => {
    const v = videoRef.current
    if (v) setCurrentTime(v.currentTime)
  }, [])

  // MediaRecorder WebM files carry no duration, so the browser reports
  // Infinity until it has read the whole file. Fall back to the session's.
  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const fallback = data?.session?.duration_seconds || 0
    setDuration(Number.isFinite(v.duration) && v.duration > 0 ? v.duration : fallback)
  }, [data])

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
    videoRef, data, error, videoUrl, waitingForVideo,
    playing, currentTime, duration, speed,
    toggle, seekTo, setSpeed, setPlaying,
    onTimeUpdate, onLoadedMetadata,
    sessionMsToVideoSeconds
  }
}
