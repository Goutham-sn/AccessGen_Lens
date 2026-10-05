import { LoadingSpinner } from '../shared/LoadingSpinner.jsx'
import { getVideoFilter, SimulationFilterDefs } from '../../data/simulationFilters.jsx'

// True <video> playback of the FFmpeg-compiled session recording.
// Canvas overlays (tunnel vision, blotches) are baked into the frames;
// CSS/SVG filter effects are re-applied here so playback matches the
// live experience exactly.
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
      <SimulationFilterDefs />
      <video
        ref={videoRef}
        src={videoUrl}
        className="w-full rounded-xl bg-black"
        style={{ filter: getVideoFilter(session) }}
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
