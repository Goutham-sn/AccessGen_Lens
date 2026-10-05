import { useCallback, useEffect, useRef, useState } from 'react'
import { api, mediaUrl } from '../services/api.js'
import { uploadWindowEndsAt } from '../utils/uploadWindow.js'

const POLL_MS = 4000
// Loads playback data and controls the <video> element.
export function usePlayback(sessionId) {
  const videoRef = useRef(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  // True while video_url is still empty and the upload window (measured from
  // the session's end, not from when this page opened) is still open. The
  // recording can arrive after the backend has already marked the session
  // no_video, so the status alone can't say whether a video is coming.
  const [waitingForVideo, setWaitingForVideo] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeedState] = useState(1)

  useEffect(() => {
    let cancelled = false
    let timer = null
    let loaded = false
    let lastSession = null
    setWaitingForVideo(true)

    // Keep polling until the upload window closes. A session already past
    // it shows "No recording" straight away, with no spinner.
    const pollAgain = () => {
      if (Date.now() < uploadWindowEndsAt(lastSession)) timer = setTimeout(load, POLL_MS)
      else setWaitingForVideo(false)
    }

    function load() {
      api.get(`/playback/${sessionId}`)
        .then((d) => {
          if (cancelled) return
          loaded = true
          lastSession = d.session
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
  // An extension recording starts recording_offset_ms into the session, so
  // its length is the session's length minus that. Runner videos are cut to
  // their own length already.
  const onLoadedMetadata = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    const s = data?.session
    const fallback = s?.source === 'runner'
      ? (s.duration_seconds || 0)
      : Math.max(0, (s?.duration_seconds || 0) - (s?.recording_offset_ms || 0) / 1000)
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
