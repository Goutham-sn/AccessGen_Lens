import { LoadingSpinner } from '../shared/LoadingSpinner.jsx'
import { getVideoFilter } from '../../data/simulationFilters.jsx'

// <video> playback of the session recording. Every recording already shows
// the simulation (it records the screen), so nothing is re-applied here.
export function PlaybackPlayer({ videoRef, videoUrl, processing, session, onTimeUpdate, onLoadedMetadata, onEnded }) {
  if (processing) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl bg-ink-900 text-white">
        <LoadingSpinner label="Waiting for the recording" />
      </div>
    )
  }

  if (!videoUrl) {
    return (
      <div className="flex h-96 items-center justify-center rounded-xl bg-ink-900 text-gray-300 text-sm px-6 text-center">
        No recording. This session ended without a video.
      </div>
    )
  }

  return (
    <>
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full rounded-xl bg-black"
        style={{ filter: getVideoFilter() }}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
        playsInline
        preload="metadata"
        aria-label="Session recording"
      >
        Your browser cannot play this video.
      </video>
    </>
  )
}
