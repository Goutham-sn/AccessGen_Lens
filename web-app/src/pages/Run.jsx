import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper.jsx'
import { SessionResults } from '../components/results/SessionResults.jsx'
import { taskProgressLine } from '../utils/taskForm.js'
import { api } from '../services/api.js'
import { getSocket } from '../services/socket.js'
import { avatarColorFor } from '../data/personaCards.js'

const POLL_MS = 3000
const MAX_LOG = 400

function statusText(session, phase) {
  if (session.complete) {
    if (session.status === 'no_video' || !session.hasVideo) {
      return session.coverage?.stoppedReason ? `Finished without a recording. ${session.coverage.stoppedReason}` : 'Finished without a recording.'
    }
    return session.coverage?.stoppedReason || 'Finished'
  }
  if (phase) return phase
  if (session.status === 'queued') return 'Waiting for a free browser'
  return 'Getting started'
}

function clock(at, start) {
  const s = Math.max(0, Math.floor((at - start) / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// What the runner is doing on the site, as it does it: its own browser's
// screen, a line for every step, and each problem as it is confirmed.
function LiveRun({ session, live, phase }) {
  const start = live.log[0]?.at || Date.now()
  const steps = live.log.filter((l) => l.kind === 'step').length
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="min-w-0">
        <div className="overflow-hidden rounded-lg border border-ink-900 bg-ink-900">
          <div className="flex items-center justify-between gap-3 border-b border-ink-700 px-3 py-2 font-mono text-[11px] text-paper/80">
            <span className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-ember-500" aria-hidden="true" />
              {live.frame?.pass === 'record' ? 'Second pass, on camera, as the person sees it' : live.frame ? 'First pass: measuring every place on the page' : 'Waiting for the first picture'}
            </span>
            <span className="truncate">{session.url}</span>
          </div>
          {live.frame ? (
            <img src={live.frame.src} alt={`The runner's browser on your page, live: ${live.log[live.log.length - 1]?.text || ''}`} className="block w-full" />
          ) : (
            <div className="flex aspect-[16/10] items-center justify-center text-sm text-paper/60">{phase || 'Starting the browser'}</div>
          )}
        </div>
        <p role="status" className="mt-2 font-mono text-xs text-ink-600">{phase || 'Working'} · {steps} steps so far</p>
      </div>

      <div className="space-y-5">
        <section aria-labelledby={`log-${session.id}`}>
          <h3 id={`log-${session.id}`} className="eyebrow">What is happening</h3>
          <ol className="mt-2 max-h-[360px] overflow-y-auto rounded-lg border border-rule bg-white font-mono text-xs leading-relaxed" aria-live="off">
            {live.log.slice().reverse().map((l, i) => (
              <li key={live.log.length - i} className={`flex gap-3 border-b border-rule px-3 py-1.5 last:border-0 ${l.kind === 'summary' ? 'bg-mist font-semibold text-ink-900' : 'text-ink-700'}`}>
                <span className="shrink-0 text-ink-400">{clock(l.at, start)}</span>
                <span className="min-w-0 break-words">{l.text}</span>
              </li>
            ))}
            {!live.log.length && <li className="px-3 py-2 text-ink-500">Nothing yet.</li>}
          </ol>
        </section>
        <section aria-labelledby={`found-${session.id}`}>
          <h3 id={`found-${session.id}`} className="eyebrow">Confirmed on camera · {live.moments.length}</h3>
          <ol className="mt-2 space-y-2" aria-live="polite">
            {live.moments.map((m) => (
              <li key={m.number} className="rounded-lg border border-rule border-l-4 border-l-ember-600 bg-white p-3">
                <p className="text-sm font-semibold text-ink-900">{m.headline}</p>
                {m.element?.name && <p className="mt-0.5 font-mono text-xs text-ink-600">{m.element.role} “{m.element.name}”</p>}
                {m.fact && <p className="mt-1 text-sm text-ink-700">{m.fact}</p>}
              </li>
            ))}
            {!live.moments.length && <li className="text-sm text-ink-500">Problems appear here as the second pass shows them.</li>}
          </ol>
        </section>
      </div>
    </div>
  )
}

// One run: every person followed, one tab each. While a person is being
// followed the tab shows it live; when they are done, the tab is their
// full results, on this same page.
export default function Run() {
  const { runId } = useParams()
  const [run, setRun] = useState(null)
  const [error, setError] = useState(null)
  const [active, setActive] = useState(null)
  const [phases, setPhases] = useState({})
  const [live, setLive] = useState({}) // sessionId -> { log, frame, moments }

  useEffect(() => {
    let cancelled = false
    let timer
    async function load() {
      try {
        const data = await api.get(`/runs/${runId}`)
        if (cancelled) return
        setRun(data)
        setActive((a) => a || data.sessions[0]?.id || null)
        if (!data.sessions.every((s) => s.complete)) timer = setTimeout(load, POLL_MS)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    load()
    return () => { cancelled = true; clearTimeout(timer) }
  }, [runId])

  const sessionIds = useMemo(() => (run?.sessions || []).map((s) => s.id).join(','), [run])
  useEffect(() => {
    if (!sessionIds) return
    const socket = getSocket(null)
    const ids = sessionIds.split(',')
    for (const id of ids) socket.emit('join-session', { sessionId: id })
    const patch = (id, fn) => setLive((all) => {
      const cur = all[id] || { log: [], frame: null, moments: [] }
      return { ...all, [id]: fn(cur) }
    })
    const onPhase = ({ sessionId, label }) => setPhases((p) => ({ ...p, [sessionId]: label }))
    const onLog = (l) => patch(l.sessionId, (c) => ({ ...c, log: [...c.log, l].slice(-MAX_LOG) }))
    const onFrame = (f) => patch(f.sessionId, (c) => ({ ...c, frame: f }))
    const onMoment = (m) => patch(m.sessionId, (c) => ({ ...c, moments: [...c.moments, m] }))
    const onDone = () => api.get(`/runs/${runId}`).then(setRun).catch(() => {})
    socket.on('run-phase', onPhase)
    socket.on('run-log', onLog)
    socket.on('run-frame', onFrame)
    socket.on('run-moment', onMoment)
    socket.on('run-done', onDone)
    return () => {
      for (const id of ids) socket.emit('leave-session', { sessionId: id })
      socket.off('run-phase', onPhase)
      socket.off('run-log', onLog)
      socket.off('run-frame', onFrame)
      socket.off('run-moment', onMoment)
      socket.off('run-done', onDone)
    }
  }, [sessionIds, runId])

  const current = run?.sessions.find((s) => s.id === active)
  const done = run?.sessions.filter((s) => s.complete).length || 0
  const going = run && done < run.sessions.length
  const [stopping, setStopping] = useState(false)
  const [stopError, setStopError] = useState(null)

  async function stopRun() {
    if (!window.confirm('Stop this run now? What has been recorded so far is not kept.')) return
    setStopping(true)
    setStopError(null)
    try {
      await api.post(`/runs/${runId}/cancel`)
      setRun(await api.get(`/runs/${runId}`))
    } catch (err) {
      setStopError(err.message)
    } finally {
      setStopping(false)
    }
  }

  return (
    <PageWrapper
      wide
      eyebrow="Automated run"
      title={run ? run.url : 'Loading'}
      actions={going ? (
        <button type="button" onClick={stopRun} disabled={stopping}
          className="inline-flex min-h-[40px] items-center rounded-[4px] border border-ember-600 bg-white px-4 text-sm font-medium text-ember-700 hover:bg-ember-50 disabled:opacity-60">
          {stopping ? 'Stopping…' : 'Stop this run'}
        </button>
      ) : null}
    >
      {error && <p role="alert" className="text-ember-700">{error}</p>}
      {run && (
        <>
          {stopError && <p role="alert" className="mb-4 text-ember-700">Could not stop the run: {stopError}</p>}
          {going && run.runner && !run.runner.alive && (
            <div role="alert" className="mb-6 border-l-4 border-ember-600 bg-ember-50 p-4">
              <p className="font-semibold text-ink-900">Nothing is running this yet: the runner is not responding.</p>
              <p className="mt-1 text-ink-700">
                The runner is the part that opens your page in its own browser. Start it, or see why it stopped, from the
                folder with docker-compose.yml:
              </p>
              <pre className="mt-2 overflow-x-auto rounded-[3px] bg-white px-3 py-2 font-mono text-sm text-ink-900">docker compose up -d --build runner{'\n'}docker compose logs --tail 50 runner</pre>
              <p className="mt-2 text-sm text-ink-700">The run starts by itself as soon as the runner is up. Or stop it with the button above.</p>
            </div>
          )}
          {going && run.runner?.alive && run.queue?.waiting && (
            <p className="mb-4 font-mono text-sm text-ink-600">
              Waiting in line{run.queue.ahead ? `: ${run.queue.ahead} run${run.queue.ahead === 1 ? '' : 's'} ahead` : ''}{run.queue.running ? `, ${run.queue.running} running now` : ''}.
            </p>
          )}
          <p className="-mt-4 mb-6 text-ink-700">
            {done === run.sessions.length
              ? `All ${run.sessions.length === 1 ? 'done' : `${run.sessions.length} done`}. Everything is below.`
              : `Following ${run.sessions.length === 1 ? 'one person' : `${run.sessions.length} people`} through your page. ${done} of ${run.sessions.length} finished.`}
          </p>

          {run.task && (
            <section aria-labelledby="run-task-heading" className="mb-6 card p-4">
              <h2 id="run-task-heading" className="font-semibold text-ink-900">What each person is looking for</h2>
              <p className="mt-1 text-sm text-ink-700">{run.task.goal}</p>
              <ol className="mt-2 list-decimal pl-5 text-sm text-ink-900">{run.task.intents.map((t, i) => <li key={i}>{t}</li>)}</ol>
            </section>
          )}

          <div role="tablist" aria-label="People followed" className="flex flex-wrap gap-0 border-b border-rule">
            {run.sessions.map((s) => {
              const on = s.id === active
              return (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  id={`tab-${s.id}`}
                  aria-selected={on}
                  aria-controls={`panel-${s.id}`}
                  onClick={() => setActive(s.id)}
                  className={`-mb-px flex items-center gap-2.5 border-b-2 px-4 py-3 text-left ${on ? 'border-ink-900' : 'border-transparent hover:bg-white'}`}
                >
                  <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-ink-900" style={{ background: avatarColorFor(s.personaName) || '#e3e0d8' }}>
                    {(s.personaName || '?').charAt(0)}
                  </span>
                  <span>
                    <span className={`block text-sm ${on ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>{s.personaName || 'Someone'}</span>
                    <span className="block font-mono text-[11px] text-ink-500">{s.complete ? 'finished' : statusText(s, phases[s.id]).toLowerCase()}</span>
                  </span>
                </button>
              )
            })}
          </div>

          {current && (
            <div role="tabpanel" id={`panel-${current.id}`} aria-labelledby={`tab-${current.id}`} className="pt-6">
              {current.complete ? (
                <>
                  {taskProgressLine(current.personaName || 'Someone', current.taskProgress) && (
                    <p className="mb-4 font-medium text-ink-900">{taskProgressLine(current.personaName || 'Someone', current.taskProgress)}</p>
                  )}
                  <SessionResults key={current.id} sessionId={current.id} embedded />
                </>
              ) : (
                <LiveRun session={{ ...current, url: run.url }} live={live[current.id] || { log: [], frame: null, moments: [] }} phase={statusText(current, phases[current.id])} />
              )}
            </div>
          )}
        </>
      )}
    </PageWrapper>
  )
}
