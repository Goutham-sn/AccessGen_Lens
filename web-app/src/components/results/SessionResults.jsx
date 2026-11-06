import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, API_URL } from '../../services/api.js'
import { usePlayback } from '../../hooks/usePlayback.js'
import { useSocket } from '../../hooks/useSocket.js'
import { PlaybackPlayer } from '../playback/PlaybackPlayer.jsx'
import { Timeline } from '../playback/Timeline.jsx'
import { PlaybackControls } from '../playback/PlaybackControls.jsx'
import { IssueList } from './IssueList.jsx'
import { JourneyMap } from '../report/JourneyMap.jsx'
import { LookedAt } from '../report/LookedAt.jsx'
import { TaskList } from '../report/TaskList.jsx'
import { ShareDialog } from '../shared/ShareDialog.jsx'
import { LoadingSpinner } from '../shared/LoadingSpinner.jsx'
import { Button } from '../shared/Button.jsx'
import { getProfile, SEVERITY_LABELS } from '../../data/profiles.js'
import { formatDuration, isAutoMoment } from '../../utils/moments.js'
import { formatMs } from '../../utils/missionChain.js'
import { issueCounts } from '../../utils/issues.js'
import { useSessionStore } from '../../store/sessionStore.js'

function headlineOf(session, moments, mission, counts) {
  const who = session.persona_snapshot?.name || 'The visitor'
  if (mission?.as?.outcome === 'gave-up') return `${who} gave up.`
  if (mission?.ratio && mission.ratio >= 1.3) return `It took ${who} ${mission.ratio}× as long.`
  if (mission?.as?.outcome === 'done') return `${who} got there, in ${formatMs(mission.as.durationMs)}.`
  if (counts.issues) return `${counts.issues} ${counts.issues === 1 ? 'issue' : 'issues'} on ${counts.elements} ${counts.elements === 1 ? 'element' : 'elements'}.`
  if (moments.some((m) => !isAutoMoment(m))) return `${who} struggled with this page.`
  if (session.coverage?.stoppedReason && !session.video_url) return session.coverage.cancelled ? 'This run was stopped.' : `${who} could not get through this page.`
  return `${who} spent ${formatDuration(session.duration_seconds)} on this page.`
}

function Mission({ mission, who }) {
  if (!mission) return null
  const cell = (label, side, accent) => (
    <div className={`border-l-2 pl-3 ${accent ? 'border-ember-600' : 'border-ink-900'}`}>
      <p className="eyebrow">{label}</p>
      <p className={`num mt-1 text-3xl font-semibold ${accent ? 'text-ember-700' : 'text-ink-900'}`}>{side?.durationMs != null ? formatMs(side.durationMs) : 'n/a'}</p>
      <p className="mt-0.5 text-sm text-ink-600">{side?.outcome === 'done' ? 'Did it' : side?.outcome === 'gave-up' ? 'Gave up' : side ? 'Ended without saying' : 'Not run'}</p>
    </div>
  )
  return (
    <div className="rounded-lg border border-rule bg-white p-4">
      <p className="eyebrow">Mission</p>
      <p className="mt-1 font-medium text-ink-900">“{mission.goal}”</p>
      <div className="mt-4 grid grid-cols-2 gap-4">
        {mission.you ? cell('You', mission.you, false) : <div />}
        {cell(`As ${who}`, mission.as, true)}
      </div>
      {mission.ratio >= 1.3 && <p className="mt-3 text-sm font-semibold text-ember-700">{mission.ratio}× longer than you.</p>}
    </div>
  )
}

// Everything about one session on one page: what happened, the video with
// every moment on its timeline, every issue with every element, what could
// not be decided, and every action. No separate playback or report pages.
export function SessionResults({ sessionId, embedded = false }) {
  const navigate = useNavigate()
  const pb = usePlayback(sessionId)
  const [report, setReport] = useState(null)
  const [error, setError] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [pdf, setPdf] = useState('idle')
  const pollRef = useRef(null)
  const deleteSession = useSessionStore((s) => s.deleteSession)

  const load = () => api.get(`/reports/${sessionId}`).then(setReport).catch((e) => setError(e.message))
  useEffect(() => { load(); return () => clearInterval(pollRef.current) }, [sessionId]) // eslint-disable-line react-hooks/exhaustive-deps
  useSocket(sessionId, { 'session-processed': () => { load(); api.get(`/playback/${sessionId}`).then(() => window.location.reload()).catch(() => {}) } })

  // ?at=<ms>: open at that moment (links from elsewhere).
  const jumped = useRef(false)
  useEffect(() => {
    const at = Number(new URLSearchParams(window.location.search).get('at'))
    if (jumped.current || !Number.isFinite(at) || !at || !pb.duration) return
    const sec = pb.sessionMsToVideoSeconds(at)
    if (sec == null) return
    jumped.current = true
    pb.seekTo(Math.max(0, sec - 1.5))
  }, [pb])

  if (error) return <p role="alert" className="text-ember-700">{error}</p>
  if (!report || !pb.data) return <LoadingSpinner label="Loading the session" />

  const { session, events, empathyMoments: moments, humanSummary, mission } = report
  const counts = issueCounts(moments)
  const persona = session.persona_snapshot
  const who = persona?.name || 'them'
  const processing = !session.video_url && pb.waitingForVideo
  const reviewLines = (session.coverage?.notes || []).filter((l) => l.startsWith('Check by hand'))
  const lookedAt = report.lookedAt ? { ...report.lookedAt, gaps: (report.lookedAt.gaps || []).filter((l) => !l.startsWith('Check by hand')) } : null

  const watch = (m) => {
    const sec = pb.sessionMsToVideoSeconds(m.timestamp_ms)
    if (sec == null) return
    pb.seekTo(Math.max(0, sec - 1))
    document.getElementById(`player-${sessionId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  async function downloadPdf() {
    setPdf('generating')
    await api.post(`/reports/${sessionId}/pdf`)
    pollRef.current = setInterval(async () => {
      const res = await fetch(`${API_URL}/api/reports/${sessionId}/pdf`)
      if (!res.ok) return
      clearInterval(pollRef.current)
      const url = URL.createObjectURL(await res.blob())
      const a = document.createElement('a')
      a.href = url
      a.download = `accessgen-lens-${sessionId.slice(0, 8)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      setPdf('idle')
    }, 2500)
  }

  async function remove() {
    if (!window.confirm('Delete this session, its video and its pictures for good?')) return
    await deleteSession(sessionId)
    navigate('/dashboard')
  }

  const conditions = (session.active_profiles || []).map((ap) => {
    const p = getProfile(ap.id)
    return `${p?.name || ap.name || ap.id}${p?.hasSeverity && ap.severity ? ` (${SEVERITY_LABELS[ap.severity].toLowerCase()})` : ''}`
  })

  return (
    <article aria-label={`Session results${persona ? ` for ${persona.name}` : ''}`}>
      {/* What happened */}
      <header className={embedded ? '' : 'border-b border-rule pb-6'}>
        <p className="eyebrow">
          {session.source === 'runner' ? 'Automated' : 'Manual'} · {new Date(session.start_time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })} · {formatDuration(session.duration_seconds)}
        </p>
        <h2 className="mt-2 text-3xl font-semibold leading-tight text-ink-900 sm:text-4xl">{headlineOf(session, moments, mission, counts)}</h2>
        <p className="mt-2 break-all text-ink-700">
          <a href={session.url} target="_blank" rel="noreferrer" className="underline decoration-rule underline-offset-4 hover:decoration-ink-900">{session.url}</a>
        </p>
        <p className="mt-1 text-sm text-ink-600">
          {persona ? `${persona.name}${persona.age ? `, ${persona.age}` : ''} · ` : ''}{conditions.join(', ') || 'No simulation (as yourself)'}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => setShareOpen(true)}>Share a link</Button>
          <Button variant="secondary" onClick={downloadPdf} disabled={pdf === 'generating'}>{pdf === 'generating' ? 'Making the PDF…' : 'Download PDF'}</Button>
          <Link to="/start" state={{ url: session.url }} className="inline-flex min-h-[40px] items-center rounded-[4px] border border-ink-900/20 bg-white px-4 text-sm font-medium text-ink-900 hover:border-ink-900/60">Try it as someone else</Link>
          {!embedded && <Button variant="danger" onClick={remove}>Delete</Button>}
        </div>
      </header>

      {/* Numbers, mission, video */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div id={`player-${sessionId}`} className="min-w-0 scroll-mt-20">
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
          <Timeline currentTime={pb.currentTime} duration={pb.duration} empathyMoments={moments} sessionMsToVideoSeconds={pb.sessionMsToVideoSeconds} onSeek={pb.seekTo} />
          <PlaybackControls
            playing={pb.playing} toggle={pb.toggle} speed={pb.speed} setSpeed={pb.setSpeed}
            empathyMoments={moments} currentTime={pb.currentTime} sessionMsToVideoSeconds={pb.sessionMsToVideoSeconds}
            onSeek={pb.seekTo} onShare={() => setShareOpen(true)}
          />
        </div>
        <aside className="space-y-4">
          <dl className="grid grid-cols-2 border-l border-t border-rule">
            {[
              [counts.issues, counts.issues === 1 ? 'issue' : 'issues'],
              [counts.elements, counts.elements === 1 ? 'element affected' : 'elements affected'],
              [counts.felt, counts.felt === 1 ? 'moment felt' : 'moments felt'],
              [counts.review, 'to check by hand']
            ].map(([v, l]) => (
              <div key={l} className="flex flex-col border-b border-r border-rule bg-white p-3">
                <dt className="order-2 text-xs text-ink-600">{l}</dt>
                <dd className={`num order-1 font-mono text-2xl font-semibold ${v && l.startsWith('issue') ? 'text-ember-700' : 'text-ink-900'}`}>{v}</dd>
              </div>
            ))}
          </dl>
          <Mission mission={mission} who={who} />
          <TaskList session={session} />
        </aside>
      </div>

      {/* Every issue */}
      <section aria-labelledby={`issues-${sessionId}`} className="mt-12">
        <p className="eyebrow">01</p>
        <h2 id={`issues-${sessionId}`} className="mt-1 text-2xl font-semibold text-ink-900">Every issue found</h2>
        <div className="mt-6">
          <IssueList moments={moments} reviewLines={reviewLines} onWatch={watch} emptyText={report.noMomentsText} />
        </div>
      </section>

      <div className="mt-14">
        <p className="eyebrow">02</p>
        <JourneyMap session={session} events={events} empathyMoments={moments} />
      </div>

      {lookedAt && (
        <section className="mt-14">
          <p className="eyebrow">03</p>
          <div className="mt-1"><LookedAt lookedAt={lookedAt} idPrefix={`looked-${sessionId}`} /></div>
        </section>
      )}

      {humanSummary?.length > 0 && (
        <section aria-labelledby={`plain-${sessionId}`} className="mt-14 max-w-3xl">
          <p className="eyebrow">{lookedAt ? '04' : '03'}</p>
          <h2 id={`plain-${sessionId}`} className="mt-1 text-2xl font-semibold text-ink-900">In plain words</h2>
          <div className="mt-3 space-y-3 text-ink-700">{humanSummary.map((p, i) => <p key={i}>{p}</p>)}</div>
          <p className="mt-6 text-sm text-ink-500">{report.intro} {report.snapshotNote}</p>
        </section>
      )}

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} sessionId={sessionId} />
    </article>
  )
}
