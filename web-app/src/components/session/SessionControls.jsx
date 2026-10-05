import { useEffect, useState } from 'react'
import { Button } from '../shared/Button.jsx'

function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// Shows the real recording state reported by the extension. The elapsed
// time only runs while the tab video is actually being recorded.
export function SessionControls({
  isRecording, onStop, stopping,
  recordingState, recordingError, recordingStartedAt, recordShortcut
}) {
  const [now, setNow] = useState(Date.now())
  const live = recordingState === 'recording'

  useEffect(() => {
    if (!live) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [live])

  let status
  if (stopping) {
    status = recordingState === 'uploaded'
      ? <span className="text-sm font-medium text-green-800">Recording saved. Opening playback…</span>
      : <span className="text-sm text-ink-700">Saving recording…</span>
  } else if (live) {
    status = (
      <span className="flex items-center gap-2 text-sm font-medium text-red-700">
        <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-red-600 animate-pulse" />
        Recording
      </span>
    )
  } else if (recordingState === 'failed') {
    status = (
      <span className="text-sm text-red-800">
        Recording failed: {recordingError}. Switch to the simulated tab and try the shortcut again.
      </span>
    )
  } else {
    status = (
      <span className="text-sm text-ink-700">
        Not recording yet. Switch to the simulated tab and{' '}
        {recordShortcut
          ? <>press <kbd className="rounded border border-gray-300 bg-gray-50 px-1 font-mono text-xs">{recordShortcut}</kbd>, or </>
          : null}
        click the AccessGen Lens icon and choose Start recording.
        {!recordShortcut && ' No shortcut is set. Assign one at chrome://extensions/shortcuts.'}
      </span>
    )
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {/* Only state changes are announced; the ticking timer stays outside
            the live region so screen readers are not interrupted every second. */}
        <div role="status" aria-live="polite">{status}</div>
        {live && !stopping && (
          <span className="text-sm tabular-nums text-ink-700" aria-label="Recording length">
            {formatElapsed(now - (recordingStartedAt || now))}
          </span>
        )}
      </div>
      <Button variant="danger" onClick={onStop} disabled={stopping || !isRecording}>
        {stopping ? 'Stopping…' : 'Stop session'}
      </Button>
    </div>
  )
}
