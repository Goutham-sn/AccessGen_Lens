import { useEffect, useRef } from 'react'

// Rolling log of what the simulated screen reader announced.
export function ScreenReaderLog({ announcements }) {
  const listRef = useRef(null)

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [announcements.length])

  return (
    <section aria-labelledby="sr-log-heading" className="card p-4">
      <h2 id="sr-log-heading" className="text-sm font-semibold text-ink-900 mb-2">
        What the screen reader said
      </h2>
      <div
        ref={listRef}
        className="h-56 overflow-y-auto rounded-lg bg-ink-900 p-3 font-mono text-xs text-green-300 space-y-1.5"
        tabIndex={0}
        role="log"
        aria-label="Screen reader announcements"
      >
        {announcements.length === 0 ? (
          <p className="text-gray-400">Waiting for the first announcement…</p>
        ) : (
          announcements.map((a, i) => (
            <p key={i}>
              <span className="text-gray-500 mr-2">
                {new Date(a.at || Date.now()).toLocaleTimeString()}
              </span>
              {a.text}
            </p>
          ))
        )}
      </div>
    </section>
  )
}
