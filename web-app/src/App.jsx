import { lazy, Suspense, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore.js'
import { useSessionStore } from './store/sessionStore.js'
import { listenFromExtension } from './services/extension-bridge.js'
import { LoadingSpinner } from './components/shared/LoadingSpinner.jsx'

const Landing = lazy(() => import('./pages/Landing.jsx'))
const Onboarding = lazy(() => import('./pages/Onboarding.jsx'))
const Dashboard = lazy(() => import('./pages/Dashboard.jsx'))
const Configure = lazy(() => import('./pages/Configure.jsx'))
const Session = lazy(() => import('./pages/Session.jsx'))
const Playback = lazy(() => import('./pages/Playback.jsx'))
const Report = lazy(() => import('./pages/Report.jsx'))
const Run = lazy(() => import('./pages/Run.jsx'))
const Start = lazy(() => import('./pages/Start.jsx'))
const Personas = lazy(() => import('./pages/Personas.jsx'))
const Team = lazy(() => import('./pages/Team.jsx'))
const SharedReport = lazy(() => import('./pages/SharedReport.jsx'))

function RequireAuth({ children }) {
  const user = useAuthStore((s) => s.user)
  const location = useLocation()
  if (!user) return <Navigate to="/onboarding" state={{ from: location }} replace />
  return children
}

// Fires when the user ends a session from the overlay on the simulated
// page (its "Stop Simulation" button) rather than from this app's own
// Session page — the extension closes that tab itself, so this app needs
// its own way to notice the recording is ready and jump to it.
function useExtensionSessionEndedListener() {
  const navigate = useNavigate()
  const clearLiveSession = useSessionStore((s) => s.clearLiveSession)

  useEffect(() => {
    return listenFromExtension((msg) => {
      if (msg?.event === 'session-ended' && msg.sessionId) {
        clearLiveSession()
        navigate(`/playback/${msg.sessionId}`)
      }
    })
  }, [navigate, clearLiveSession])
}

export default function App() {
  useExtensionSessionEndedListener()

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <LoadingSpinner label="Loading AccessGen Lens" />
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/onboarding" element={<Onboarding />} />
        <Route path="/shared/:token" element={<SharedReport />} />
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/configure" element={<RequireAuth><Configure /></RequireAuth>} />
        <Route path="/session/:id" element={<RequireAuth><Session /></RequireAuth>} />
        <Route path="/playback/:id" element={<RequireAuth><Playback /></RequireAuth>} />
        <Route path="/report/:id" element={<RequireAuth><Report /></RequireAuth>} />
        <Route path="/run/:runId" element={<RequireAuth><Run /></RequireAuth>} />
        <Route path="/start" element={<RequireAuth><Start /></RequireAuth>} />
        <Route path="/personas" element={<RequireAuth><Personas /></RequireAuth>} />
        <Route path="/team" element={<RequireAuth><Team /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
