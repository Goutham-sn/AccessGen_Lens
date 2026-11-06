import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ReportCover } from '../components/report/ReportCover.jsx'
import { TaskList } from '../components/report/TaskList.jsx'
import { IssueList } from '../components/results/IssueList.jsx'
import { listMoments } from '../utils/issues.js'
import { Button } from '../components/shared/Button.jsx'
import { LoadingSpinner } from '../components/shared/LoadingSpinner.jsx'
import { mediaUrl, API_URL } from '../services/api.js'
import { getVideoFilter } from '../data/simulationFilters.jsx'
import { FramePlayer, playableFrames } from '../components/playback/FramePlayer.jsx'

// Public, no-auth view of a shared session: the video and its moments.
export default function SharedReport() {
  const videoRef = useRef(null)
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
    <div className="min-h-screen bg-paper">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <header className="bg-white border-b border-rule h-14 flex items-center px-4">
        <span className="flex items-center gap-2 font-semibold text-ink-900">
          <span aria-hidden="true" className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-ink-900 text-white text-sm">◉</span>
          AccessGen Lens: shared report
        </span>
      </header>
      <main id="main-content" className="mx-auto max-w-4xl px-4 py-10">
        {loading && <LoadingSpinner label="Opening the report" />}

        {!loading && needsPassword && (
          <form
            onSubmit={(e) => { e.preventDefault(); load(password) }}
            className="max-w-sm mx-auto card p-6 space-y-4"
          >
            <h1 className="text-lg font-semibold text-ink-900">This report is protected</h1>
            <div>
              <label htmlFor="report-password" className="block text-sm font-medium text-ink-700 mb-1">Password</label>
              <input
                id="report-password" type="password" value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
              />
            </div>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            <Button type="submit" className="w-full">Open report</Button>
          </form>
        )}

        {!loading && !needsPassword && error && <p role="alert" className="text-red-700">{error}</p>}

        {!loading && data && (
          <div className="space-y-10">
            <ReportCover session={data.session} empathyMoments={listMoments(data.empathyMoments)} mission={data.mission} />
            <TaskList session={data.session} idPrefix="shared-task" />
            {(data.session.video_url || playableFrames(data.frames).length >= 2) && (
              <section aria-labelledby="shared-watch-heading">
                <h2 id="shared-watch-heading" className="sr-only">The recording</h2>
                {!data.session.video_url ? (
                  <FramePlayer frames={data.frames} controls label="Full session recording" />
                ) : (
                <video
                  ref={videoRef}
                  src={mediaUrl(data.session.video_url)}
                  controls playsInline preload="metadata"
                  className="w-full rounded-xl bg-black"
                  style={{ filter: getVideoFilter() }}
                  aria-label="Full session recording"
                />
                )}
              </section>
            )}
            <section aria-labelledby="shared-moments-heading">
              <h2 id="shared-moments-heading" className="text-2xl font-semibold text-ink-900">
                Moments <span className="num font-mono text-lg text-ink-500">{listMoments(data.empathyMoments).length}</span>
              </h2>
              <div className="mt-4">
                <IssueList
                  moments={data.empathyMoments}
                  emptyText={data.noMomentsText}
                  onWatch={data.session.video_url ? (m) => {
                    const v = videoRef.current
                    if (!v) return
                    v.currentTime = Math.max(0, (m.timestamp_ms - (data.session.recording_offset_ms || 0)) / 1000 - 1)
                    v.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  } : null}
                />
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  )
}
