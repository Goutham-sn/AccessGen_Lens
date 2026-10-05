import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper.jsx'
import { Button } from '../components/shared/Button.jsx'
import { Badge } from '../components/shared/Badge.jsx'
import { LoadingSpinner } from '../components/shared/LoadingSpinner.jsx'
import { useSessionStore } from '../store/sessionStore.js'
import { useAuthStore } from '../store/authStore.js'
import { getProfile } from '../data/profiles.js'
import { mediaUrl } from '../services/api.js'

function SessionCard({ session, onDelete }) {
  const persona = session.persona_snapshot
  const statusTone = session.status === 'complete' ? 'success'
    : session.status === 'recording' ? 'danger'
      : session.status === 'no_video' ? 'neutral' : 'warning'
  const statusLabel = session.status === 'complete' ? 'Ready'
    : session.status === 'recording' ? 'Recording'
      : session.status === 'no_video' ? 'No recording' : 'Processing'

  return (
    <article className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col">
      {session.page_thumbnail ? (
        <img src={mediaUrl(session.page_thumbnail)} alt="" className="h-32 w-full object-cover" loading="lazy" />
      ) : (
        <div aria-hidden="true" className="h-32 bg-gray-100" />
      )}
      <div className="p-4 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <Badge tone={statusTone}>{statusLabel}</Badge>
          <span className="text-xs text-ink-500">{new Date(session.created_at).toLocaleDateString()}</span>
        </div>
        <h3 className="mt-2 font-medium text-ink-900 truncate" title={session.url}>
          {session.page_title || session.url}
        </h3>
        <p className="text-sm text-ink-600">
          {persona ? `As ${persona.name}` : `${(session.active_profiles || []).length} profile(s)`}
          {' · '}{Math.round((session.duration_seconds || 0) / 60)} min
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
            to={`/playback/${session.id}`}
            className="flex-1 rounded-lg bg-brand-700 px-3 py-2 text-center text-sm font-medium text-white hover:bg-brand-800"
          >
            Watch
          </Link>
          <Link
            to={`/report/${session.id}`}
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

  useEffect(() => { fetchSessions() }, [fetchSessions])

  async function handleDelete(id) {
    if (window.confirm('Delete this session and its recording permanently?')) {
      await deleteSession(id)
    }
  }

  return (
    <PageWrapper
      title={`Welcome${user?.name ? `, ${user.name}` : ''}`}
      actions={
        <Link to="/configure">
          <Button size="lg">New session</Button>
        </Link>
      }
    >
      <section aria-labelledby="sessions-heading">
        <h2 id="sessions-heading" className="text-lg font-medium text-ink-900 mb-4">Your sessions</h2>
        {sessionsLoading ? (
          <LoadingSpinner label="Loading your sessions" />
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center">
            <p className="text-ink-600">You haven't experienced anything yet.</p>
            <p className="mt-1 text-sm text-ink-500">
              Start your first session and feel what your visitors feel.
            </p>
            <Link to="/configure" className="mt-6 inline-block">
              <Button>Choose your first experience</Button>
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sessions.map((s) => (
              <SessionCard key={s.id} session={s} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </section>
    </PageWrapper>
  )
}
