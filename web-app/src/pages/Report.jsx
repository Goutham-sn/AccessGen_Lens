import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper.jsx'
import { ReportCover } from '../components/report/ReportCover.jsx'
import { SimulationBanner } from '../components/start/SimulationBanner.jsx'
import { JourneyMap } from '../components/report/JourneyMap.jsx'
import { EmpathyMoments } from '../components/report/EmpathyMoments.jsx'
import { LookedAt } from '../components/report/LookedAt.jsx'
import { TaskList } from '../components/report/TaskList.jsx'
import { SnapshotNote } from '../components/report/SnapshotNote.jsx'
import { BeforeAfter } from '../components/report/BeforeAfter.jsx'
import { HumanSummary } from '../components/report/HumanSummary.jsx'
import { NoticedSummary } from '../components/report/NoticedSummary.jsx'
import { isAutoMoment, formatDuration } from '../utils/moments.js'
import { ShareDialog } from '../components/shared/ShareDialog.jsx'
import { Button } from '../components/shared/Button.jsx'
import { LoadingSpinner } from '../components/shared/LoadingSpinner.jsx'
import { api, mediaUrl, API_URL } from '../services/api.js'
import { useAuthStore } from '../store/authStore.js'
import { getVideoFilter } from '../data/simulationFilters.jsx'

export default function Report() {
  const { id } = useParams()
  const accessToken = useAuthStore((s) => s.accessToken)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [pdfState, setPdfState] = useState('idle') // idle | generating | ready
  const pollRef = useRef(null)

  useEffect(() => {
    api.get(`/reports/${id}`).then(setData).catch((e) => setError(e.message))
    return () => clearInterval(pollRef.current)
  }, [id])

  async function downloadPdf() {
    setPdfState('generating')
    await api.post(`/reports/${id}/pdf`)
    // Poll until the PDF exists, then trigger the download.
    pollRef.current = setInterval(async () => {
      const res = await fetch(`${API_URL}/api/reports/${id}/pdf`, {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
      if (res.ok) {
        clearInterval(pollRef.current)
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `empathy-report-${id}.pdf`
        a.click()
        URL.revokeObjectURL(url)
        setPdfState('ready')
      }
    }, 3000)
  }

  if (error) {
    return <PageWrapper title="Report"><p role="alert" className="text-red-700">{error}</p></PageWrapper>
  }
  if (!data) {
    return <PageWrapper title="Report"><LoadingSpinner label="Preparing the report" /></PageWrapper>
  }

  const { session, frames, events, empathyMoments, humanSummary, intro } = data
  const persona = session.persona_snapshot
  const noticedCount = empathyMoments.filter(isAutoMoment).length

  const firstFrame = frames[0]
  const momentWithShot = empathyMoments.find((m) => m.screenshot_url)
  const simulatedShot = momentWithShot?.screenshot_url || firstFrame?.screenshot_url

  return (
    <PageWrapper
      title="Empathy report"
      withSidebar={false}
      actions={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={downloadPdf} disabled={pdfState === 'generating'}>
            {pdfState === 'generating' ? 'Preparing PDF…' : 'Download PDF'}
          </Button>
          <Button onClick={() => setShareOpen(true)}>Share</Button>
        </div>
      }
    >
      <div className="space-y-8 pb-16">
        <ReportCover session={session} empathyMoments={empathyMoments} />
        <SimulationBanner text={intro} />
        <SnapshotNote ranAt={session.start_time} note={data.snapshotNote} />
        <TaskList session={session} />

        {/* The experience in numbers */}
        <section aria-labelledby="numbers-heading" className="rounded-2xl border border-gray-200 bg-white p-6">
          <h2 id="numbers-heading" className="text-xl font-semibold text-ink-900 mb-4">
            The experience in numbers
          </h2>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            {[
              [formatDuration(session.duration_seconds), 'time spent'],
              [String(empathyMoments.length - noticedCount), 'moments felt'],
              [String(noticedCount), 'struggles noticed'],
              [String(session.event_count || events.length), 'interactions needed']
            ].map(([value, label]) => (
              <div key={label} className="rounded-xl bg-gray-50 p-4">
                <dt className="order-2 text-sm text-ink-600">{label}</dt>
                <dd className="order-1 text-3xl font-semibold text-ink-900">{value}</dd>
              </div>
            ))}
          </dl>
        </section>

        <NoticedSummary empathyMoments={empathyMoments} onJump />
        <JourneyMap session={session} events={events} empathyMoments={empathyMoments} />
        <LookedAt lookedAt={data.lookedAt} />
        <EmpathyMoments empathyMoments={empathyMoments} emptyText={data.noMomentsText} />

        {/* Runner moments keep a clean picture next to the persona's view.
            Extension pictures are all taken with the simulation on, so
            there is no "before" to compare with. */}
        {session.source === 'runner' && (
          <BeforeAfter
            normalImageUrl={firstFrame ? mediaUrl(firstFrame.screenshot_url) : null}
            simulatedImageUrl={simulatedShot ? mediaUrl(simulatedShot) : null}
          />
        )}

        {/* Watch the session */}
        {session.video_url && (
          <section aria-labelledby="watch-heading" className="rounded-2xl border border-gray-200 bg-white p-6">
            <h2 id="watch-heading" className="text-xl font-semibold text-ink-900 mb-4">
              Watch the session
            </h2>
            <video
              src={mediaUrl(session.video_url)}
              poster={session.page_thumbnail ? mediaUrl(session.page_thumbnail) : undefined}
              controls
              playsInline
              preload="metadata"
              className="w-full rounded-xl bg-black"
              style={{ filter: getVideoFilter() }}
              aria-label={`Full recording of ${persona?.name || 'the visitor'}'s session`}
            />
          </section>
        )}

        <HumanSummary paragraphs={humanSummary} />
      </div>

      <ShareDialog open={shareOpen} onClose={() => setShareOpen(false)} sessionId={id} />
    </PageWrapper>
  )
}
