import { isAutoMoment, formatDuration } from '../../utils/moments.js'

// Horizontal session timeline: every interaction is a small dot,
// empathy moments are larger labelled markers.
export function JourneyMap({ session, events, empathyMoments }) {
  const totalMs = (session.duration_seconds || 1) * 1000
  const pos = (ms) => Math.max(0, Math.min(100, (ms / totalMs) * 100))

  return (
    <section aria-labelledby="journey-heading" className="card p-6">
      <h2 id="journey-heading" className="text-xl font-semibold text-ink-900 mb-1">The journey</h2>
      <p className="text-sm text-ink-600 mb-8">
        Every dot is an interaction. Red markers are where the tester felt it break down; amber ones are struggles the simulation noticed.
      </p>

      <div className="relative mx-2 h-24" role="img"
        aria-label={`Timeline of ${events.length} interactions with ${empathyMoments.length} moments of struggle`}>
        <div aria-hidden="true" className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-300" />

        {events.slice(0, 400).map((e, i) => (
          <span
            key={e.id || i}
            aria-hidden="true"
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-1.5 w-1.5 rounded-full bg-brand-400"
            style={{ left: `${pos(e.timestamp_ms)}%` }}
          />
        ))}

        {empathyMoments.map((m) => (
          <span
            key={m.id}
            aria-hidden="true"
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${pos(m.timestamp_ms)}%` }}
          >
            {!isAutoMoment(m) && (
              <span className="absolute bottom-6 w-max max-w-[140px] text-center text-xs font-medium text-ember-800 leading-tight">
                {m.label}
              </span>
            )}
            <span className={`rounded-full border-2 border-white shadow ${isAutoMoment(m) ? 'h-4 w-4 bg-ink-900' : 'h-5 w-5 bg-ember-600'}`} />
          </span>
        ))}
      </div>

      <div className="flex justify-between text-xs text-ink-500 mt-2 mx-2" aria-hidden="true">
        <span>Start</span>
        <span>{formatDuration(session.duration_seconds)} later</span>
      </div>
    </section>
  )
}
