import { getProfile, SEVERITY_LABELS } from '../../data/profiles.js'
import { avatarColorFor } from '../../data/personaCards.js'
import { isAutoMoment, formatDuration } from '../../utils/moments.js'
import { formatMs } from '../../utils/missionChain.js'
import { MissionResult } from './MissionResult.jsx'
import { PinnedShot } from './PinnedShot.jsx'

// The opening of a report: who, what happened, and (with a mission) the
// two numbers side by side. Dark, because this is the experience part.
export function ReportCover({ session, empathyMoments, mission = null, eventCount = 0 }) {
  const persona = session.persona_snapshot
  const who = persona?.name || 'the visitor'
  const Who = persona?.name || 'The visitor'
  const duration = formatDuration(session.duration_seconds)
  const felt = empathyMoments.filter((m) => !isAutoMoment(m))
  const noticed = empathyMoments.length - felt.length
  const place = session.page_title || 'this page'
  const gaveUp = mission?.as?.outcome === 'gave-up' || felt.some((m) => m.label === 'Would have given up')

  let headline
  if (mission?.as?.outcome === 'gave-up') headline = `${Who} gave up.`
  else if (mission?.ratio && mission.ratio >= 1.3) headline = `It took ${who} ${mission.ratio}× as long.`
  else if (mission?.as?.outcome === 'done') headline = `${Who} got there, in ${formatMs(mission.as.durationMs)}.`
  else if (gaveUp) headline = `${Who} nearly gave up on ${place}.`
  else if (empathyMoments.length) headline = `${Who} struggled with ${place}${empathyMoments.length > 1 ? ` ${empathyMoments.length} times` : ''}.`
  else headline = `${Who} spent ${duration} on ${place}.`

  const hero = empathyMoments.find((m) => isAutoMoment(m) && m.screenshot_url && m.rect?.vw) || empathyMoments.find((m) => m.screenshot_url)
  const stats = [
    [duration, 'with the page'],
    [String(felt.length), felt.length === 1 ? 'moment felt' : 'moments felt'],
    [String(noticed), noticed === 1 ? 'struggle noticed' : 'struggles noticed'],
    [String(eventCount || session.event_count || 0), 'interactions']
  ]

  return (
    <section aria-label="Report cover" className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 text-white sm:p-12">
      <div aria-hidden="true" className="grain pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand-600/30 blur-[100px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-0 h-80 w-80 rounded-full bg-ember-500/20 blur-[100px]" />
      <div className="relative">
        <div className="flex flex-wrap items-center gap-4">
          {persona && (
            <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full text-xl font-semibold text-ink-900"
              style={{ backgroundColor: persona.illustrationColor || avatarColorFor(persona.name) || '#d1ccff' }}>
              {persona.name.charAt(0)}
            </span>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">
              Empathy report · {new Date(session.start_time).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="mt-0.5 text-sm text-white/60 break-all">{session.url}</p>
          </div>
        </div>
        <h1 className="mt-8 max-w-3xl font-display text-4xl font-semibold leading-[1.05] sm:text-6xl">{headline}</h1>
        <ul className="mt-5 flex flex-wrap gap-2" aria-label="Conditions experienced">
          {(session.active_profiles || []).map((ap) => {
            const p = getProfile(ap.id)
            return (
              <li key={ap.id} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/80">
                {p?.name || ap.name || ap.id}{p?.hasSeverity && ap.severity ? ` · ${SEVERITY_LABELS[ap.severity]}` : ''}
              </li>
            )
          })}
        </ul>

        <MissionResult mission={mission} who={persona?.name || 'them'} />

        <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl bg-white/10 sm:grid-cols-4">
          {stats.map(([value, label]) => (
            <div key={label} className="flex flex-col bg-ink-950/80 p-4">
              <dt className="order-2 text-xs text-white/50">{label}</dt>
              <dd className="order-1 font-display text-2xl font-semibold">{value}</dd>
            </div>
          ))}
        </dl>

        {hero?.screenshot_url && (
          <figure className="mt-8">
            <PinnedShot src={hero.screenshot_url} rect={hero.rect} alt={`The page as ${who} met it: ${hero.label}`} className="rounded-2xl ring-1 ring-white/10" />
            <figcaption className="mt-2 text-sm text-white/55">{isAutoMoment(hero) ? hero.label : `“${hero.label}”`}</figcaption>
          </figure>
        )}
      </div>
    </section>
  )
}
