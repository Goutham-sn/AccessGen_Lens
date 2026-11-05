import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore.js'
import { useSessionStore } from './store/sessionStore.js'
import { listenFromExtension } from './services/extension-bridge.js'
import { api } from './services/api.js'
import { loadChain } from './utils/missionChain.js'
import { LoadingSpinner } from './components/shared/LoadingSpinner.jsx'

const Landing = lazy(() => import('./pages/Landing.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Configure = lazy(() => import('./pages/Configure.jsx'))
const Session = lazy(() => import('./pages/Session.jsx'))
const Results = lazy(() => import('./pages/Results.jsx'))
const ToResults = lazy(() => import('./pages/Results.jsx').then((m) => ({ default: m.ToResults })))
const Run = lazy(() => import('./pages/Run.jsx'))
const Start = lazy(() => import('./pages/Start.jsx'))
const Personas = lazy(() => import('./pages/Personas.jsx'))
const Team = lazy(() => import('./pages/Team.jsx'))
const SharedReport = lazy(() => import('./pages/SharedReport.jsx'))
const StepIn = lazy(() => import('./pages/StepIn.jsx'))

// No sign-in: every page is open. Kept as a pass-through so routes read the same.
function RequireAuth({ children }) {
  return children
}

// Fires when the user ends a session from the overlay on the simulated
// page (its "Stop Simulation" button) rather than from this app's own
// Session page: the extension closes that tab itself, so this app needs
// its own way to notice the recording is ready and jump to it.
function useExtensionSessionEndedListener() {
  const navigate = useNavigate()
  const clearLiveSession = useSessionStore((s) => s.clearLiveSession)

  useEffect(() => {
    return listenFromExtension((msg) => {
      if (msg?.event === 'session-ended' && msg.sessionId) {
        // The extension has already ended it on the backend. If that request
        // was lost (the worker was stopped by Chrome, the backend was busy),
        // this ends it now, so it never stays "Recording". A session that
        // has ended already is left exactly as it is.
        api.post(`/sessions/${msg.sessionId}/end`, {}).catch(() => {})
        clearLiveSession()
        // The first run of a two-run mission goes to the step-in page,
        // which starts the run as the person.
        const chain = loadChain()
        if (chain?.baselineSessionId === msg.sessionId) navigate(`/next/${msg.sessionId}`)
        else navigate(`/results/${msg.sessionId}`)
      }
    })
  }, [navigate, clearLiveSession])
}

export default function App() {
  useExtensionSessionEndedListener()
  const loadUser = useAuthStore((s) => s.load)
  useEffect(() => { loadUser() }, [loadUser])

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LoadingSpinner label="Loading AccessGen Lens" />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/lens" element={<Landing />} />
        <Route path="/onboarding" element={<Navigate to="/dashboard" replace />} />
        <Route path="/shared/:token" element={<SharedReport />} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/configure" element={<RequireAuth><Configure /></RequireAuth>} />
        <Route path="/session/:id" element={<RequireAuth><Session /></RequireAuth>} />
        <Route path="/results/:id" element={<Results />} />
        <Route path="/playback/:id" element={<ToResults />} />
        <Route path="/report/:id" element={<ToResults />} />
        <Route path="/run/:runId" element={<RequireAuth><Run /></RequireAuth>} />
        <Route path="/start" element={<RequireAuth><Start /></RequireAuth>} />
        <Route path="/next/:id" element={<RequireAuth><StepIn /></RequireAuth>} />
        <Route path="/personas" element={<RequireAuth><Personas /></RequireAuth>} />
        <Route path="/team" element={<RequireAuth><Team /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
