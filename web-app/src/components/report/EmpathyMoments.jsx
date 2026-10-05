import { getProfile } from '../../data/profiles.js'
import { mediaUrl } from '../../services/api.js'
import { Badge } from '../shared/Badge.jsx'

const LABEL_STORIES = {
  'Got completely stuck here': 'Progress stopped completely at this point. There was no obvious way forward.',
  'Could not find this': 'Something needed was effectively invisible or unreachable here.',
  'Would have given up': 'This is the moment a real visitor would have closed the tab.',
  'This took too long': 'The task was possible, but the effort it demanded was unreasonable.',
  'This makes no sense': 'The page gave no usable clue about what was happening or what to do.',
  'I felt excluded': 'The design assumed abilities this visitor does not have.'
}

function fmtMs(ms) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function EmpathyMoments({ empathyMoments, personaName }) {
  if (empathyMoments.length === 0) {
    return (
      <section className="rounded-2xl border border-green-200 bg-green-50 p-6">
        <h2 className="text-xl font-semibold text-green-900">No breakdown moments</h2>
        <p className="mt-2 text-green-800">
          {personaName || 'The visitor'} made it through without flagging a single moment of struggle.
          That is genuinely worth celebrating.
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="moments-heading" className="space-y-4">
      <h2 id="moments-heading" className="text-xl font-semibold text-ink-900">
        Where it broke down
      </h2>
      {empathyMoments.map((m, i) => (
        <article key={m.id} className="rounded-2xl border border-gray-200 bg-white overflow-hidden sm:flex">
          {m.screenshot_url && (
            <img
              src={mediaUrl(m.screenshot_url)}
              alt={`The page at the moment: ${m.label}`}
              className="sm:w-2/5 object-cover"
              loading="lazy"
            />
          )}
          <div className="p-5 flex-1">
            <p className="text-xs text-ink-500 tabular-nums">
              Moment {i + 1} · {fmtMs(m.timestamp_ms)} into the session
            </p>
            <h3 className="mt-1 text-lg font-semibold text-rose-800">"{m.label}"</h3>
            {m.note && <p className="mt-2 text-ink-700 italic">"{m.note}"</p>}
            <p className="mt-2 text-sm text-ink-600">{LABEL_STORIES[m.label] || ''}</p>
            {Array.isArray(m.active_profiles) && m.active_profiles.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Active profiles at this moment">
                {m.active_profiles.map((ap) => {
                  const p = getProfile(ap.id)
                  return <li key={ap.id}><Badge tone="neutral">{p?.name || ap.name || ap.id}</Badge></li>
                })}
              </ul>
            )}
          </div>
        </article>
      ))}
    </section>
  )
}
