import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper.jsx'
import { LookedAt } from '../components/report/LookedAt.jsx'
import { taskProgressLine } from '../utils/taskForm.js'
import { api } from '../services/api.js'
import { getSocket } from '../services/socket.js'
import { useAuthStore } from '../store/authStore.js'

const POLL_MS = 3000

// Plain words for each state, before a live phase message arrives.
function statusText(session, phase) {
  if (session.complete) {
    if (session.status === 'no_video' || !session.hasVideo) {
      return session.coverage?.stoppedReason
        ? `Finished without a recording. ${session.coverage.stoppedReason}`
        : 'Finished without a recording.'
    }
    return session.coverage?.stoppedReason || 'Ready. The recording is saved.'
  }
  if (phase) return `${phase}…`
  if (session.status === 'queued') return 'Waiting for a free browser…'
  return 'Getting started…'
}

// One card per person followed. Live phase messages arrive over the socket;
// polling is the fallback and also notices when everything is finished.
export default function Run() {
  const { runId } = useParams()
  const accessToken = useAuthStore((s) => s.accessToken)
  const [run, setRun] = useState(null)
  const [phases, setPhases] = useState({})
  const [error, setError] = useState(null)

  const allDone = Boolean(run?.sessions?.length) && run.sessions.every((s) => s.complete)

  useEffect(() => {
    let cancelled = false
    let timer
    async function load() {
      try {
        const data = await api.get(`/runs/${runId}`)
        if (cancelled) return
        setRun(data)
        if (!data.sessions.every((s) => s.complete)) timer = setTimeout(load, POLL_MS)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    load()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [runId])

  const sessionIds = (run?.sessions || []).map((s) => s.id).join(',')
  useEffect(() => {
    if (!sessionIds) return
    const socket = getSocket(accessToken)
    const ids = sessionIds.split(',')
    for (const id of ids) socket.emit('join-session', { sessionId: id })
    const onPhase = ({ sessionId, label }) => setPhases((p) => ({ ...p, [sessionId]: label }))
    const onDone = () => api.get(`/runs/${runId}`).then(setRun).catch(() => {})
    socket.on('run-phase', onPhase)
    socket.on('run-done', onDone)
    return () => {
      for (const id of ids) socket.emit('leave-session', { sessionId: id })
      socket.off('run-phase', onPhase)
      socket.off('run-done', onDone)
    }
  }, [sessionIds, accessToken, runId])

  return (
    <PageWrapper title="Watch it happen">
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!run && !error && <p className="text-sm text-ink-600">Loading…</p>}

      {run && (
        <>
          <p className="mb-6 text-ink-700">
            Following {run.sessions.length === 1 ? 'one person' : `${run.sessions.length} people`} through{' '}
            <span className="break-all font-medium text-ink-900">{run.url}</span>.
            {!allDone && (run.task ? ' This takes longer when there is something to find.' : ' This usually takes under a minute.')}
          </p>

          {run.task && (
            <section aria-labelledby="run-task-heading" className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
              <h2 id="run-task-heading" className="text-base font-semibold text-ink-900">What each person is looking for</h2>
              <p className="mt-1 text-sm text-ink-700">Goal: {run.task.goal}</p>
              <ol className="mt-2 list-decimal pl-5 text-sm text-ink-900">
                {run.task.intents.map((text, i) => <li key={i}>{text}</li>)}
              </ol>
            </section>
          )}

          <ul className="grid gap-4 sm:grid-cols-2">
            {run.sessions.map((s) => (
              <li key={s.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <h2 className="text-lg font-semibold text-ink-900">{s.personaName || 'Someone'}</h2>
                <p role="status" className="mt-1 text-sm text-ink-700">
                  {statusText(s, phases[s.id])}
                </p>
                {s.complete && taskProgressLine(s.personaName || 'Someone', s.taskProgress) && (
                  <p className="mt-2 text-sm font-medium text-ink-900">{taskProgressLine(s.personaName || 'Someone', s.taskProgress)}</p>
                )}
                {s.complete && s.lookedAt && (
                  <div className="mt-4 space-y-3">
                    <LookedAt lookedAt={s.lookedAt} headingLevel={3} idPrefix={`looked-at-${s.id}`} />
                    {s.lookedAt.zeroMoments && <p className="text-sm text-ink-700">{s.lookedAt.zeroMoments}</p>}
                  </div>
                )}
                {s.complete && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      to={`/results/${s.id}`}
                      className="inline-flex min-h-[40px] items-center rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
                    >
                      Watch the playback<span className="sr-only"> for {s.personaName}</span>
                    </Link>
                    <Link
                      to={`/results/${s.id}`}
                      className="inline-flex min-h-[40px] items-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-ink-700 hover:bg-gray-100"
                    >
                      Read the report<span className="sr-only"> for {s.personaName}</span>
                    </Link>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </PageWrapper>
  )
}
