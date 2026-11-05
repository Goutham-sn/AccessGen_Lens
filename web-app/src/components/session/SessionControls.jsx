import { useEffect, useState } from 'react'
import { Button } from '../shared/Button.jsx'

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// The screen is recorded from the first second (the extension captures the
// tab's real pixels), so there is no "not recording yet" state any more.
// A smoother tab video can still be switched on from the extension; its
// state is shown as a detail.
export function SessionControls({
  isRecording, onStop, stopping,
  recordingState, recordingError, recordShortcut, startedAt
}) {
  const [now, setNow] = useState(Date.now())
  const smooth = recordingState === 'recording'

  useEffect(() => {
    if (stopping) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [stopping])

  let detail = null
  if (stopping) {
    detail = recordingState === 'uploaded' ? 'Recording saved. Opening playback…' : 'Saving the recording and building the video…'
  } else if (smooth) {
    detail = 'Smooth video is on.'
  } else if (recordingState === 'failed') {
    detail = `Smooth video could not start (${recordingError}). The screen is still being recorded.`
  } else {
    detail = (
      <>
        Want a smoother video? On the simulated tab{' '}
        {recordShortcut
          ? <>press <kbd className="rounded border border-rule bg-paper px-1 font-mono text-xs">{recordShortcut}</kbd> or </>
          : null}
        click the AccessGen Lens icon and choose Turn on smooth video.
      </>
    )
  }

  return (
    <div className="card p-4 flex flex-wrap items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          {/* Only state changes are announced; the ticking timer stays outside
              the live region so screen readers are not interrupted every second. */}
          <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm font-medium text-red-700">
            {!stopping && <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />}
            {stopping ? 'Ending the session' : 'Recording the screen'}
          </div>
          {!stopping && startedAt && (
            <span className="text-sm tabular-nums text-ink-700" aria-label="Session length">
              {formatElapsed(now - startedAt)}
            </span>
          )}
        </div>
        <p className="mt-1 text-xs text-ink-600">{detail}</p>
      </div>
      <Button variant="danger" onClick={onStop} disabled={stopping || !isRecording}>
        {stopping ? 'Stopping…' : 'End session and see the report'}
      </Button>
    </div>
  )
}
