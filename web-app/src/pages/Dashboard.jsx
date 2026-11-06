import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper.jsx'
import { LoadingSpinner } from '../components/shared/LoadingSpinner.jsx'
import { useSessionStore } from '../store/sessionStore.js'
import { getProfile } from '../data/profiles.js'
import { formatDuration } from '../utils/moments.js'
import { formatMs } from '../utils/missionChain.js'
import { mediaUrl, api } from '../services/api.js'
import { getExtensionStatus } from '../services/extension-bridge.js'

const STATUS = {
  complete: ['Ready', 'text-ink-900'],
  recording: ['In progress', 'text-ember-700'],
  processing: ['Making the video', 'text-ink-600'],
  queued: ['Waiting', 'text-ink-600'],
  running: ['Running', 'text-ember-700'],
  no_video: ['No video', 'text-ink-500']
}

function who(session) {
  const p = session.persona_snapshot
  if (p) return `${p.name}${p.age ? `, ${p.age}` : ''}`
  const names = (session.active_profiles || []).map((ap) => getProfile(ap.id)?.name || ap.name || ap.id)
  return names.length ? names.join(', ') : 'As yourself'
}

function Row({ session, live, onFinish }) {
  const [label, tone] = STATUS[session.status] || [session.status, 'text-ink-600']
  // An automated session still going has its live run page; one that is
  // finished has its results.
  const href = session.source === 'runner' && !session.processing_complete && session.run_id
    ? `/run/${session.run_id}`
    : `/results/${session.id}`
  const stuck = session.status === 'recording' && live !== undefined && live !== session.id
  const m = session.mission
  return (
    <li className="group grid grid-cols-[88px_minmax(0,1fr)] gap-4 border-b border-rule py-4 sm:grid-cols-[120px_minmax(0,1fr)_150px_110px]">
      <Link to={href} tabIndex={-1} aria-hidden="true" className="block overflow-hidden rounded-[4px] border border-rule bg-white">
        {session.page_thumbnail
          ? <img src={mediaUrl(session.page_thumbnail)} alt="" className="aspect-[16/10] w-full object-cover object-top" loading="lazy" />
          : <div className="aspect-[16/10] w-full bg-mist" />}
      </Link>
      <div className="min-w-0">
        <Link to={href} className="block truncate font-medium text-ink-900 underline-offset-4 group-hover:underline">
          {session.page_title || session.url.replace(/^https?:\/\//, '')}
        </Link>
        <p className="mt-0.5 truncate text-sm text-ink-600">{who(session)} · {session.source === 'runner' ? 'Automated' : 'Manual'}</p>
        {m?.goal && (
          <p className="mt-1 truncate text-sm text-ink-700">
            “{m.goal}”{m.outcome && <span className={m.outcome === 'done' ? 'text-ink-600' : 'font-medium text-ember-700'}> · {m.outcome === 'done' ? `did it in ${formatMs(m.durationMs)}` : 'gave up'}</span>}
          </p>
        )}
        {stuck && (
          <p className="mt-1 text-sm text-ember-700">
            Never ended (the tab may have closed). <button type="button" onClick={() => onFinish(session.id)} className="underline">Finish it now</button>
          </p>
        )}
      </div>
      <div className="col-start-2 font-mono text-xs text-ink-600 sm:col-start-auto">
        <p className={tone}>{label}</p>
        <p className="mt-0.5">{new Date(session.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} · {formatDuration(session.duration_seconds)}</p>
      </div>
      <div className="col-start-2 font-mono text-xs sm:col-start-auto sm:text-right">
        <p className="num text-lg font-semibold text-ink-900">{session.empathy_moment_count}</p>
        <p className="text-ink-500">{session.empathy_moment_count === 1 ? 'finding' : 'findings'}</p>
      </div>
    </li>
  )
}

export default function Dashboard() {
  const { sessions, sessionsLoading, fetchSessions } = useSessionStore()
  const [live, setLive] = useState(undefined)
  const [filter, setFilter] = useState('all')

  useEffect(() => { fetchSessions() }, [fetchSessions])
  useEffect(() => {
    getExtensionStatus().then((s) => setLive(s?.isActive ? s.sessionId : null)).catch(() => setLive(null))
  }, [])

  async function finish(id) {
    try { await api.post(`/sessions/${id}/end`, { recordingExpected: false }) } catch { /* the refresh shows it */ }
    fetchSessions()
  }

  const shown = sessions.filter((s) => filter === 'all' || (filter === 'manual' ? s.source !== 'runner' : s.source === 'runner'))

  return (
    <PageWrapper
      title="Sessions"
      actions={<Link to="/start" className="inline-flex min-h-[40px] items-center rounded-[4px] bg-ink-900 px-4 text-sm font-medium text-paper hover:bg-ink-700">New session</Link>}
    >
      {sessionsLoading ? (
        <LoadingSpinner label="Loading your sessions" />
      ) : sessions.length === 0 ? (
        <div className="max-w-2xl">
          <p className="text-xl font-semibold text-ink-900">Nothing here yet.</p>
          <p className="mt-2 text-ink-700">
            Pick one page you own and one person. Give yourself a mission, do it as yourself, then as them.
            You come back with the time it took, the exact places it broke, and every issue on the page.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/start" className="inline-flex min-h-[44px] items-center rounded-[4px] bg-ink-900 px-5 font-medium text-paper hover:bg-ink-700">Start a session</Link>
            <Link to="/lens" className="inline-flex min-h-[44px] items-center rounded-[4px] border border-ink-900/20 px-5 font-medium text-ink-900 hover:border-ink-900/60">Try the lens first</Link>
          </div>
        </div>
      ) : (
        <>
          <div role="group" aria-label="Show" className="mb-2 flex gap-4 font-mono text-xs">
            {[['all', 'All'], ['manual', 'Manual'], ['automated', 'Automated']].map(([v, l]) => (
              <button key={v} type="button" aria-pressed={filter === v} onClick={() => setFilter(v)}
                className={filter === v ? 'font-semibold text-ink-900 underline underline-offset-4' : 'text-ink-500 hover:text-ink-900'}>
                {l} ({sessions.filter((s) => v === 'all' || (v === 'manual' ? s.source !== 'runner' : s.source === 'runner')).length})
              </button>
            ))}
          </div>
          <ul className="border-t border-ink-900">
            {shown.map((s) => <Row key={s.id} session={s} live={live} onFinish={finish} />)}
          </ul>
        </>
      )}
    </PageWrapper>
  )
}
