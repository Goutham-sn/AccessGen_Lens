import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper.jsx'
import { PlaybackPlayer } from '../components/playback/PlaybackPlayer.jsx'
import { Timeline } from '../components/playback/Timeline.jsx'
import { PlaybackControls } from '../components/playback/PlaybackControls.jsx'
import { EmpathySidebar } from '../components/playback/EmpathySidebar.jsx'
import { ShareDialog } from '../components/shared/ShareDialog.jsx'
import { LoadingSpinner } from '../components/shared/LoadingSpinner.jsx'
import { Badge } from '../components/shared/Badge.jsx'
import { usePlayback } from '../hooks/usePlayback.js'
import { useSocket } from '../hooks/useSocket.js'
import { getProfile, SEVERITY_LABELS } from '../data/profiles.js'
import { api } from '../services/api.js'
import { formatDuration } from '../utils/moments.js'

export default function Playback() {
  const { id } = useParams()
  const pb = usePlayback(id)
  // /playback/:id?at=<ms>: open at that moment of the session (from the
  // report's "Watch this moment").
  const [search] = useSearchParams()
  const jumped = useRef(false)
  const at = Number(search.get('at'))
  useEffect(() => {
    if (jumped.current || !Number.isFinite(at) || !search.get('at') || !pb.duration) return
    const sec = pb.sessionMsToVideoSeconds(at)
    if (sec == null) return
    jumped.current = true
    pb.seekTo(Math.max(0, sec - 1.5))
  }, [at, search, pb.duration, pb])
  const [shareOpen, setShareOpen] = useState(false)

  // When the video finishes compiling, refetch to pick up the video URL.
  useSocket(id, {
    'session-processed': () => {
      api.get(`/playback/${id}`).then(() => window.location.reload()).catch(() => {})
    }
  })

  if (pb.error) {
    return (
      <PageWrapper title="Playback">
        <p role="alert" className="text-red-700">{pb.error}</p>
      </PageWrapper>
    )
  }
  if (!pb.data) {
    return (
      <PageWrapper title="Playback">
        <LoadingSpinner label="Loading session" />
      </PageWrapper>
    )
  }

  const { session, empathyMoments } = pb.data
  const persona = session.persona_snapshot
  // Not tied to status: the 90 s fallback can mark the session no_video
  // shortly before a late upload lands.
  const processing = !session.video_url && pb.waitingForVideo

  return (
    <PageWrapper title="Relive the session" withSidebar={false}>
      <div className="grid gap-6 lg:grid-cols-[240px_1fr_300px]">
        {/* Left sidebar: metadata */}
        <aside aria-label="Session details" className="space-y-4 order-2 lg:order-1">
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm space-y-3">
            <div>
              <h2 className="font-semibold text-ink-900 text-xs uppercase tracking-wide mb-1">Page</h2>
              <p className="text-ink-700 break-all">{session.url}</p>
            </div>
            <div>
              <h2 className="font-semibold text-ink-900 text-xs uppercase tracking-wide mb-1">Date</h2>
              <p className="text-ink-700">{new Date(session.start_time).toLocaleString()}</p>
            </div>
            <div>
              <h2 className="font-semibold text-ink-900 text-xs uppercase tracking-wide mb-1">Duration</h2>
              <p className="text-ink-700">{formatDuration(session.duration_seconds)}</p>
            </div>
            {persona && (
              <div>
                <h2 className="font-semibold text-ink-900 text-xs uppercase tracking-wide mb-1">Persona</h2>
                <p className="text-ink-700">{persona.name}, {persona.age}</p>
              </div>
            )}
            <div>
              <h2 className="font-semibold text-ink-900 text-xs uppercase tracking-wide mb-1">Profiles</h2>
              <ul className="flex flex-wrap gap-1.5">
                {(session.active_profiles || []).map((ap) => {
                  const p = getProfile(ap.id)
                  return (
                    <li key={ap.id}>
                      <Badge tone="neutral">
                        {p?.name || ap.name || ap.id}
                        {p?.hasSeverity && ap.severity ? ` · ${SEVERITY_LABELS[ap.severity]}` : ''}
                      </Badge>
                    </li>
                  )
                })}
              </ul>
            </div>
            <Link
              to={`/report/${session.id}`}
              className="block rounded-lg bg-brand-700 px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-800"
            >
              View empathy report
            </Link>
          </div>
        </aside>

        {/* Main: video player */}
        <div className="order-1 lg:order-2">
          <PlaybackPlayer
            videoRef={pb.videoRef}
            videoUrl={pb.videoUrl}
            processing={processing}
            session={session}
            frames={pb.data.frames}
            onTimeUpdate={pb.onTimeUpdate}
            onLoadedMetadata={pb.onLoadedMetadata}
            onEnded={() => pb.setPlaying(false)}
          />
          <Timeline
            currentTime={pb.currentTime}
            duration={pb.duration}
            empathyMoments={empathyMoments}
            sessionMsToVideoSeconds={pb.sessionMsToVideoSeconds}
            onSeek={pb.seekTo}
          />
          <PlaybackControls
            playing={pb.playing}
            toggle={pb.toggle}
            speed={pb.speed}
            setSpeed={pb.setSpeed}
            empathyMoments={empathyMoments}
            currentTime={pb.currentTime}
            sessionMsToVideoSeconds={pb.sessionMsToVideoSeconds}
            onSeek={pb.seekTo}
            onShare={() => setShareOpen(true)}
          />
        </div>

        {/* Right sidebar: empathy moments */}
        <div className="order-3">
          <EmpathySidebar
            empathyMoments={empathyMoments}
            emptyText={pb.data.noMomentsText}
            currentTime={pb.currentTime}
            sessionMsToVideoSeconds={pb.sessionMsToVideoSeconds}
            onJump={pb.seekTo}
          />
        </div>
      </div>

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} sessionId={id} />
    </PageWrapper>
  )
}
