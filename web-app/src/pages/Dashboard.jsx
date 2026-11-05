import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper.jsx'
import { Badge } from '../components/shared/Badge.jsx'
import { LoadingSpinner } from '../components/shared/LoadingSpinner.jsx'
import { useSessionStore } from '../store/sessionStore.js'
import { useAuthStore } from '../store/authStore.js'
import { getProfile } from '../data/profiles.js'
import { formatDuration } from '../utils/moments.js'
import { formatMs } from '../utils/missionChain.js'
import { Icon } from '../components/brand/Icon.jsx'
import { avatarColorFor } from '../data/personaCards.js'
import { mediaUrl, api } from '../services/api.js'
import { getExtensionStatus } from '../services/extension-bridge.js'

function SessionCard({ session, onDelete, liveId, onFinish }) {
  const persona = session.persona_snapshot
  const statusTone = session.status === 'complete' ? 'success'
    : session.status === 'recording' ? 'danger'
      : session.status === 'no_video' ? 'neutral' : 'warning'
  const statusLabel = session.status === 'complete' ? 'Ready'
    : session.status === 'recording' ? 'Recording'
      : session.status === 'no_video' ? 'No recording' : 'Processing'

  return (
    <article className="card overflow-hidden flex flex-col transition hover:shadow-lift">
      {session.page_thumbnail ? (
        <img src={mediaUrl(session.page_thumbnail)} alt="" className="h-32 w-full object-cover object-top" loading="lazy" />
      ) : (
        <div aria-hidden="true" className="h-32 bg-gray-100" />
      )}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <Badge tone={statusTone}>{statusLabel}</Badge>
          <span className="text-xs text-ink-500">{new Date(session.created_at).toLocaleDateString()}</span>
        </div>
        {session.status === 'recording' && liveId !== undefined && liveId !== session.id && (
          <div className="mt-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
            This session was never ended (the tab or browser may have closed).{' '}
            <button type="button" onClick={() => onFinish(session.id)} className="font-semibold underline">
              Finish it now
            </button>
          </div>
        )}
        <h3 className="mt-2 font-medium text-ink-900 truncate" title={session.url}>
          {session.page_title || session.url}
        </h3>
        {session.mission?.goal && (
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-700">
            <Icon name="target" size={15} className="shrink-0 text-ember-600" />
            <span className="truncate">“{session.mission.goal}”</span>
            {session.mission.outcome && (
              <span className={`ml-auto shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${session.mission.outcome === 'done' ? 'bg-emerald-50 text-emerald-800' : 'bg-ember-50 text-ember-800'}`}>
                {session.mission.outcome === 'done' ? `Did it · ${formatMs(session.mission.durationMs)}` : 'Gave up'}
              </span>
            )}
          </p>
        )}
        <p className="text-sm text-ink-600">
          {persona ? `As ${persona.name}` : (session.active_profiles || []).length === 0 ? 'As yourself' : `${(session.active_profiles || []).length} condition${(session.active_profiles || []).length === 1 ? '' : 's'}`}
          {' · '}{formatDuration(session.duration_seconds)}
          {' · '}{session.empathy_moment_count} moment{session.empathy_moment_count === 1 ? '' : 's'}
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {(session.active_profiles || []).slice(0, 3).map((ap) => {
            const p = getProfile(ap.id)
            return <li key={ap.id}><Badge tone="neutral">{p?.name || ap.name || ap.id}</Badge></li>
          })}
        </ul>
        <div className="mt-auto pt-4 flex gap-2">
          <Link
            to={`/results/${session.id}`}
            className="flex-1 rounded-lg bg-brand-700 px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-800"
          >
            Watch
          </Link>
          <Link
            to={`/results/${session.id}`}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-medium text-ink-700 hover:bg-gray-50"
          >
            Report
          </Link>
          <button
            type="button"
            onClick={() => onDelete(session.id)}
            aria-label={`Delete session on ${session.page_title || session.url}`}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-ink-600 hover:bg-red-50 hover:text-red-800 hover:border-red-300"
          >
            Delete
          </button>
        </div>
      </div>
    </article>
  )
}

export default function Dashboard() {
  const user = useAuthStore((s) => s.user)
  const { sessions, sessionsLoading, fetchSessions, deleteSession } = useSessionStore()

  // The session the extension is running right now, if any (undefined
  // until asked, null when none), so a live session is never offered to be
  // finished from here.
  const [liveId, setLiveId] = useState(undefined)

  useEffect(() => { fetchSessions() }, [fetchSessions])
  useEffect(() => {
    getExtensionStatus()
      .then((s) => setLiveId(s?.isActive ? s.sessionId : null))
      .catch(() => setLiveId(null))
  }, [])

  async function handleFinish(id) {
    try { await api.post(`/sessions/${id}/end`, { recordingExpected: false }) } catch { /* shown by the refresh */ }
    fetchSessions()
  }

  async function handleDelete(id) {
    if (window.confirm('Delete this session and its recording permanently?')) {
      await deleteSession(id)
    }
  }

  return (
    <PageWrapper
      title={`Welcome${user?.name ? `, ${user.name}` : ''}`}
      actions={null}
    >
      <section aria-labelledby="sessions-heading">
        <h2 id="sessions-heading" className="text-lg font-medium text-ink-900 mb-4">Your sessions</h2>
        {sessionsLoading ? (
          <LoadingSpinner label="Loading your sessions" />
        ) : sessions.length === 0 ? (
          <div className="relative overflow-hidden rounded-3xl bg-ink-950 p-8 text-white sm:p-12">
            <div aria-hidden="true" className="grain pointer-events-none absolute inset-0" />
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-20 h-80 w-80 rounded-full bg-brand-600/30 blur-[100px]" />
            <p className="relative text-xs font-semibold uppercase tracking-[0.16em] text-ember-300">Your first ten minutes</p>
            <h3 className="relative mt-3 max-w-xl font-display text-4xl font-semibold leading-tight">Pick one page you own, and one person.</h3>
            <p className="relative mt-3 max-w-xl text-white/65">Give yourself a mission, do it as yourself, then as them. You will come back with a number and a picture of the exact spot it broke.</p>
            <ul className="relative mt-8 grid gap-3 sm:grid-cols-3">
              {[['Ravi', 65, "Parkinson's tremor"], ['Meera', 72, 'Macular degeneration'], ['Ananya', 19, 'Dyslexia and ADHD']].map(([n, a, l]) => (
                <li key={n}>
                  <Link to="/start#manual" className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 hover:border-white/25 hover:bg-white/10">
                    <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full font-semibold text-ink-900" style={{ background: avatarColorFor(n) || '#d1ccff' }}>{n.charAt(0)}</span>
                    <span><span className="block font-semibold">{n}, {a}</span><span className="block text-sm text-white/55">{l}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link to="/start" className="relative mt-8 inline-flex min-h-[48px] items-center gap-2 rounded-full bg-white px-6 font-semibold text-ink-900 hover:bg-brand-50">
              Start an experience <Icon name="arrow" size={18} />
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} onDelete={handleDelete} liveId={liveId} onFinish={handleFinish} />
            ))}
          </div>
        )}
      </section>
    </PageWrapper>
  )
}
