import { getProfile, SEVERITY_LABELS } from '../../data/profiles.js'
import { avatarColorFor } from '../../data/personaCards.js'
import { mediaUrl } from '../../services/api.js'
import { Badge } from '../shared/Badge.jsx'

export function ReportCover({ session, empathyMoments }) {
  const persona = session.persona_snapshot
  const who = persona?.name || 'A visitor'
  const minutes = Math.max(1, Math.round((session.duration_seconds || 0) / 60))
  const worst = empathyMoments[0]

  const headline = worst
    ? `${who} ${worst.label === 'Would have given up' ? 'nearly gave up on' : 'struggled with'} ${session.page_title || 'this page'}.`
    : `${who} spent ${minutes} minute${minutes === 1 ? '' : 's'} experiencing ${session.page_title || session.url}.`

  return (
    <section aria-label="Report cover" className="rounded-2xl bg-ink-900 text-white p-8 sm:p-12">
      {persona && (
        <span
          aria-hidden="true"
          className="mb-6 flex h-16 w-16 items-center justify-center rounded-full text-2xl font-semibold text-ink-900"
          style={{ backgroundColor: persona.illustrationColor || avatarColorFor(persona.name) || '#dbe6fe' }}
        >
          {persona.name.charAt(0)}
        </span>
      )}
      <h1 className="text-3xl sm:text-4xl font-semibold leading-tight max-w-2xl">{headline}</h1>
      <p className="mt-4 text-gray-300 break-all">
        {session.url} · {new Date(session.start_time).toLocaleDateString()} · {minutes} min
      </p>
      <ul className="mt-5 flex flex-wrap gap-2" aria-label="Profiles experienced">
        {(session.active_profiles || []).map((ap) => {
          const p = getProfile(ap.id)
          return (
            <li key={ap.id}>
              <Badge tone="neutral" className="!bg-white/10 !text-gray-100 !border-white/20">
                {p?.name || ap.name || ap.id}
                {p?.hasSeverity && ap.severity ? ` · ${SEVERITY_LABELS[ap.severity]}` : ''}
              </Badge>
            </li>
          )
        })}
      </ul>
      {session.page_thumbnail && (
        <img
          src={mediaUrl(session.page_thumbnail)}
          alt={`First view of ${session.page_title || session.url} under simulation`}
          className="mt-8 w-full rounded-xl opacity-90"
        />
      )}
    </section>
  )
}
