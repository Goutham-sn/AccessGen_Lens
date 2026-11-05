import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper.jsx'
import { LiveView } from '../components/session/LiveView.jsx'
import { ScreenReaderLog } from '../components/session/ScreenReaderLog.jsx'
import { EmpathyButton } from '../components/session/EmpathyButton.jsx'
import { SessionControls } from '../components/session/SessionControls.jsx'
import { useSession } from '../hooks/useSession.js'
import { getExtensionStatus, stopSimulation } from '../services/extension-bridge.js'
import { api } from '../services/api.js'
import { isAutoMoment, momentTitle } from '../utils/moments.js'

export default function Session() {
  const { id } = useParams()
  const navigate = useNavigate()
  const session = useSession(id)
  const [stopping, setStopping] = useState(false)
  const [remote, setRemote] = useState(null)

  const current = session.currentSession?.id === id ? session.currentSession : remote

  // If the page was reloaded mid-session, refetch the session record.
  useEffect(() => {
    if (session.currentSession?.id !== id) {
      api.get(`/sessions/${id}`).then((d) => setRemote(d.session)).catch(() => navigate('/dashboard'))
    }
  }, [id, session.currentSession, navigate])

  // Real recording state from the extension, also after a page reload.
  useEffect(() => {
    let cancelled = false
    getExtensionStatus().then((status) => {
      if (cancelled || !status) return
      const patch = { recordShortcut: status.recordShortcut || '' }
      if (status.isActive && status.sessionId === id && status.isRecording) {
        patch.recordingState = 'recording'
        patch.recordingStartedAt = status.recordingStartedAt
      }
      session.setRecording(patch)
    }).catch(() => { /* extension unreachable: keep the defaults */ })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const saveTimeout = useRef(null)
  useEffect(() => () => clearTimeout(saveTimeout.current), [])

  async function handleStop() {
    setStopping(true)
    try {
      // Handles the whole flow: flushes the last events, ends the session
      // on the backend, stops and uploads the recording, and closes the
      // simulated tab. The extension then sends session-ended, which the
      // App-level listener turns into the jump to Playback.
      await stopSimulation()
    } catch {
      // Extension unreachable: end the session directly so the user isn't
      // stuck with a session that never stops.
      try { await api.post(`/sessions/${id}/end`) } catch { /* shown on Playback */ }
      session.clearLiveSession()
      navigate(`/playback/${id}`)
      return
    }
    // Fallback in case session-ended never arrives.
    saveTimeout.current = setTimeout(() => {
      session.clearLiveSession()
      navigate(`/playback/${id}`)
    }, 60000)
  }

  const srActive = (current?.active_profiles || []).some((p) => p.id === 'screen-reader')

  return (
    <PageWrapper title="Live session" withSidebar={false}>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <SessionControls
            isRecording={session.isRecording || current?.status === 'recording'}
            onStop={handleStop}
            stopping={stopping}
            recordingState={session.recordingState}
            recordingError={session.recordingError}
            recordShortcut={session.recordShortcut}
            startedAt={session.startedAt || (current?.start_time ? new Date(current.start_time).getTime() : null)}
          />
          <LiveView session={current} focusPath={session.focusPath} />
          {srActive && <ScreenReaderLog announcements={session.announcements} />}
        </div>

        <div className="space-y-4">
          <EmpathyButton
            sessionId={id}
            startedAt={session.startedAt}
            onLogged={() => {}}
          />
          <section aria-labelledby="live-moments-heading" className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 id="live-moments-heading" className="text-sm font-semibold text-ink-900 mb-2">
              Moments so far
            </h2>
            <div aria-live="polite">
              {session.liveMoments.length === 0 ? (
                <p className="text-sm text-ink-500">
                  None yet. When something feels wrong, press "I felt this" on the page. Struggles the simulation
                  notices on its own appear here too.
                </p>
              ) : (
                <ul className="space-y-2 text-sm text-ink-700">
                  {session.liveMoments.map((m, i) => (
                    <li key={m.id || i} className="flex gap-2">
                      <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${isAutoMoment(m) ? 'bg-amber-500' : 'bg-rose-500'}`} />
                      <span>
                        {momentTitle(m)}
                        {isAutoMoment(m) && <span className="sr-only"> (noticed by the simulation)</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </PageWrapper>
  )
}
