import { Link } from 'react-router-dom'
import { getProfile } from '../../data/profiles.js'
import { UnverifiedLabel } from '../shared/UnverifiedLabel.jsx'
import { isAutoMoment, momentTitle, fmtClock } from '../../utils/moments.js'
import { PinnedShot } from './PinnedShot.jsx'
import { Icon } from '../brand/Icon.jsx'

const LABEL_STORIES = {
  'Got completely stuck here': 'Progress stopped completely at this point. There was no obvious way forward.',
  'Could not find this': 'Something needed was effectively invisible or unreachable here.',
  'Would have given up': 'This is the moment a real visitor would have closed the tab.',
  'This took too long': 'The task was possible, but the effort it demanded was unreasonable.',
  'This makes no sense': 'The page gave no usable clue about what was happening or what to do.',
  'I felt excluded': 'The design assumed abilities this visitor does not have.'
}

// emptyText: what to say when there are no moments, from the backend
// (noMomentsText). Never an all-clear. watchHref(m): a link to that second
// of the recording, or null.
export function EmpathyMoments({ empathyMoments, emptyText, watchHref = null }) {
  if (empathyMoments.length === 0) {
    if (!emptyText) return null
    return (
      <section aria-labelledby="moments-heading" className="card p-7">
        <h2 id="moments-heading" className="font-display text-2xl font-semibold text-ink-900">Moments</h2>
        <p className="mt-2 text-ink-700">{emptyText}</p>
      </section>
    )
  }

  return (
    <section aria-labelledby="moments-heading">
      <p className="eyebrow">Scene by scene</p>
      <h2 id="moments-heading" className="mt-1 font-display text-3xl font-semibold text-ink-900">Where it broke down</h2>
      <ol className="mt-6 space-y-5">
        {empathyMoments.map((m, i) => {
          const auto = isAutoMoment(m)
          const href = watchHref?.(m)
          return (
            <li key={m.id} id={`moment-${m.id}`} className="card scroll-mt-24 overflow-hidden lg:grid lg:grid-cols-[1.35fr_1fr]">
              {m.screenshot_url ? (
                <PinnedShot src={m.screenshot_url} rect={m.rect} alt={`The page at this moment: ${m.label}`} tone={auto ? 'ember' : 'amber'} />
              ) : (
                <div className="hidden bg-stone-100 lg:block" aria-hidden="true" />
              )}
              <div className="flex flex-col p-6">
                <p className="flex flex-wrap items-center gap-2 text-xs text-ink-500">
                  <span className="font-semibold tabular-nums text-ink-700">{String(i + 1).padStart(2, '0')}</span>
                  <span className="tabular-nums">{fmtClock(m.timestamp_ms)}</span>
                  {auto
                    ? <span className="rounded-full bg-ember-50 px-2 py-0.5 font-semibold text-ember-800">Noticed by the simulation</span>
                    : <span className="rounded-full bg-brand-50 px-2 py-0.5 font-semibold text-brand-800">Felt by the tester</span>}
                </p>
                {m.unverified && <p className="mt-2"><UnverifiedLabel /></p>}
                <h3 className="mt-3 font-display text-xl font-semibold leading-snug text-ink-900">{momentTitle(m)}</h3>
                {m.note && (auto
                  ? <p className="mt-2 text-ink-700">{m.note}</p>
                  : <p className="mt-2 italic text-ink-700">“{m.note}”</p>)}
                {!auto && LABEL_STORIES[m.label] && <p className="mt-2 text-sm text-ink-600">{LABEL_STORIES[m.label]}</p>}
                {Array.isArray(m.active_profiles) && m.active_profiles.length > 0 && (
                  <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Conditions at this moment">
                    {m.active_profiles.map((ap) => (
                      <li key={ap.id} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-ink-600">{getProfile(ap.id)?.name || ap.name || ap.id}</li>
                    ))}
                  </ul>
                )}
                {href && (
                  <Link to={href} className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-brand-700 hover:text-brand-900">
                    <Icon name="play" size={16} /> Watch this moment
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
