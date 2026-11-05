import { groupFriction } from '../../data/frictionKinds.js'
import { isAutoMoment, fmtClock } from '../../utils/moments.js'

// What the simulation noticed on its own while the page was being used,
// grouped by kind, so a team can see at a glance what made it hard.
export function NoticedSummary({ empathyMoments, onJump }) {
  const auto = empathyMoments.filter(isAutoMoment)
  if (auto.length === 0) return null
  const groups = groupFriction(auto)

  return (
    <section aria-labelledby="noticed-heading">
      <p className="eyebrow">What made it hard</p>
      <h2 id="noticed-heading" className="mt-1 font-display text-3xl font-semibold text-ink-900">
        {auto.length} {auto.length === 1 ? 'thing' : 'things'} pushed back
      </h2>
      <p className="mt-1 text-ink-600">Noticed by the simulation itself, as the page was used.</p>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2">
        {groups.map((g) => (
          <li key={g.key} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold text-ink-900">{g.title}</h3>
                {g.why && <p className="mt-0.5 text-sm text-ink-600">{g.why}</p>}
              </div>
              <span className="flex h-9 min-w-9 shrink-0 items-center justify-center rounded-full bg-ember-50 px-2 font-display text-lg font-semibold text-ember-700 tabular-nums">
                {g.moments.length}
              </span>
            </div>
            <ul className="mt-4 space-y-2 border-t border-black/5 pt-3 text-sm text-ink-800">
              {g.moments.slice(0, 3).map((m) => (
                <li key={m.id} className="flex gap-3">
                  {onJump ? (
                    <a href={`#moment-${m.id}`} className="shrink-0 tabular-nums font-medium text-brand-700 underline-offset-2 hover:underline">{fmtClock(m.timestamp_ms)}</a>
                  ) : (
                    <span className="shrink-0 tabular-nums text-ink-500">{fmtClock(m.timestamp_ms)}</span>
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
