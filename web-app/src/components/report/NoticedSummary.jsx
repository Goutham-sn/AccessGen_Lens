import { groupFriction } from '../../data/frictionKinds.js'
import { isAutoMoment, fmtClock } from '../../utils/moments.js'

// What the simulation noticed on its own while the tester explored, grouped
// by kind, so a team can see at a glance what made the page hard.
export function NoticedSummary({ empathyMoments, onJump }) {
  const auto = empathyMoments.filter(isAutoMoment)
  if (auto.length === 0) return null
  const groups = groupFriction(auto)

  return (
    <section aria-labelledby="noticed-heading" className="rounded-2xl border border-amber-200 bg-amber-50/60 p-6">
      <h2 id="noticed-heading" className="text-xl font-semibold text-ink-900">What made it hard</h2>
      <p className="mt-1 text-sm text-ink-700">
        Noticed by the simulation itself while the page was being used, {auto.length} time{auto.length === 1 ? '' : 's'}.
      </p>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <li key={g.key} className="rounded-xl border border-amber-200 bg-white p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-semibold text-ink-900">{g.title}</h3>
              <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-semibold text-amber-900 tabular-nums">
                {g.moments.length}
              </span>
            </div>
            {g.why && <p className="mt-1 text-sm text-ink-600">{g.why}</p>}
            <ul className="mt-3 space-y-1.5 text-sm text-ink-800">
              {g.moments.slice(0, 3).map((m) => (
                <li key={m.id} className="flex gap-2">
                  {onJump ? (
                    <a href={`#moment-${m.id}`} className="tabular-nums text-brand-700 underline shrink-0">{fmtClock(m.timestamp_ms)}</a>
                  ) : (
                    <span className="tabular-nums text-ink-500 shrink-0">{fmtClock(m.timestamp_ms)}</span>
                  )}
                  <span>{m.label}</span>
                </li>
              ))}
              {g.moments.length > 3 && <li className="text-ink-500">and {g.moments.length - 3} more</li>}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  )
}
