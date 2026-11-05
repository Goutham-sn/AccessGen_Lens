import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ReportCover } from '../components/report/ReportCover.jsx'
import { SimulationBanner } from '../components/start/SimulationBanner.jsx'
import { EmpathyMoments } from '../components/report/EmpathyMoments.jsx'
import { NoticedSummary } from '../components/report/NoticedSummary.jsx'
import { LookedAt } from '../components/report/LookedAt.jsx'
import { TaskList } from '../components/report/TaskList.jsx'
import { SnapshotNote } from '../components/report/SnapshotNote.jsx'
import { Button } from '../components/shared/Button.jsx'
import { LoadingSpinner } from '../components/shared/LoadingSpinner.jsx'
import { mediaUrl, API_URL } from '../services/api.js'
import { getVideoFilter } from '../data/simulationFilters.jsx'
import { FramePlayer, playableFrames } from '../components/playback/FramePlayer.jsx'

// Public, no-auth view of a shared empathy report.
export default function SharedReport() {
  const { token } = useParams()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [needsPassword, setNeedsPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (pwd) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_URL}/api/share/view/${token}`, {
        headers: pwd ? { 'x-share-password': pwd } : {}
      })
      const body = await res.json()
      if (res.status === 401 && body.passwordRequired) {
        setNeedsPassword(true)
        if (pwd) setError('That password is not right.')
      } else if (!res.ok) {
        setError(body.error || 'Could not load this report.')
      } else {
        setNeedsPassword(false)
        setData(body)
      }
    } catch {
      setError('Could not reach the server.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-gray-50">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="bg-white border-b border-gray-200 h-14 flex items-center px-4">
        <span className="flex items-center gap-2 font-semibold text-ink-900">
          <span aria-hidden="true" className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-700 text-white text-sm">◉</span>
          AccessGen Lens: shared report
        </span>
      </header>
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-10">
        {loading && <LoadingSpinner label="Opening the report" />}

        {!loading && needsPassword && (
          <form
            onSubmit={(e) => { e.preventDefault(); load(password) }}
            className="max-w-sm mx-auto rounded-xl border border-gray-200 bg-white p-6 space-y-4"
          >
            <h1 className="text-lg font-semibold text-ink-900">This report is protected</h1>
            <div>
              <label htmlFor="report-password" className="block text-sm font-medium text-ink-700 mb-1">Password</label>
              <input
                id="report-password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <Button type="submit" className="w-full">Open report</Button>
          </form>
        )}

        {!loading && !needsPassword && error && <p role="alert" className="text-red-700">{error}</p>}

        {!loading && data && (
          <div className="space-y-12">
            <ReportCover session={data.session} empathyMoments={data.empathyMoments} mission={data.mission} />
            <SimulationBanner text={data.intro} />
            <SnapshotNote ranAt={data.session.start_time} note={data.snapshotNote} />
            <TaskList session={data.session} idPrefix="shared-task" />
            <LookedAt lookedAt={data.lookedAt} idPrefix="shared-looked-at" />
            <NoticedSummary empathyMoments={data.empathyMoments} onJump />
            <EmpathyMoments empathyMoments={data.empathyMoments} emptyText={data.noMomentsText} />
            {(data.session.video_url || playableFrames(data.frames).length >= 2) && (
              <section aria-labelledby="shared-watch-heading" className="rounded-2xl border border-gray-200 bg-white p-6">
                <h2 id="shared-watch-heading" className="text-xl font-semibold text-ink-900 mb-4">Watch the session</h2>
                {!data.session.video_url ? (
                  <FramePlayer frames={data.frames} controls label="Full session recording" />
                ) : (
                <video
                  src={mediaUrl(data.session.video_url)}
                  controls playsInline preload="metadata"
                  className="w-full rounded-xl bg-black"
                  style={{ filter: getVideoFilter() }}
                  aria-label="Full session recording"
                />
                )}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
