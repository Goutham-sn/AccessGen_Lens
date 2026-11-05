import { formatMs } from '../../utils/missionChain.js'
import { Icon } from '../brand/Icon.jsx'

function Side({ label, side, tone }) {
  const done = side?.outcome === 'done'
  const gaveUp = side?.outcome === 'gave-up'
  const accent = tone === 'ember'
  return (
    <div className={`rounded-2xl p-5 ${accent ? 'bg-ember-500/15 ring-1 ring-ember-400/30' : 'bg-white/[0.06] ring-1 ring-white/10'}`}>
      <p className={`text-xs font-semibold uppercase tracking-[0.14em] ${accent ? 'text-ember-200' : 'text-white/55'}`}>{label}</p>
      {side ? (
        <>
          <p className={`mt-2 font-display text-4xl font-semibold sm:text-5xl ${accent ? 'text-ember-100' : 'text-white'}`}>
            {side.durationMs != null ? formatMs(side.durationMs) : '–'}
          </p>
          <p className={`mt-2 inline-flex items-center gap-1.5 text-sm font-medium ${done ? 'text-emerald-300' : gaveUp ? 'text-ember-300' : 'text-white/50'}`}>
            <Icon name={done ? 'check' : gaveUp ? 'x' : 'clock'} size={16} />
            {done ? 'Did it' : gaveUp ? 'Gave up' : 'Ended without saying'}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-white/50">Not run</p>
      )}
    </div>
  )
}

// The line that ends the meeting: the same mission, as yourself and as
// the person, side by side.
export function MissionResult({ mission, who }) {
  if (!mission) return null
  const { you, as, ratio } = mission
  let verdict = null
  if (ratio && ratio >= 1.3) verdict = `${ratio}× longer as ${who}.`
  else if (as?.outcome === 'gave-up' && you?.outcome === 'done') verdict = `You finished in ${formatMs(you.durationMs)}. ${who} gave up.`
  else if (as?.outcome === 'gave-up') verdict = `${who} gave up after ${formatMs(as.durationMs)}.`
  return (
    <div className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">The mission</p>
      <p className="mt-1 font-display text-2xl text-white">“{mission.goal}”</p>
      <div className={`mt-5 grid gap-3 ${you ? 'sm:grid-cols-2' : ''}`}>
        {you && <Side label="You" side={you} />}
        <Side label={`As ${who}`} side={as} tone="ember" />
      </div>
      {verdict && <p className="mt-4 text-lg font-semibold text-ember-300">{verdict}</p>}
    </div>
  )
}
