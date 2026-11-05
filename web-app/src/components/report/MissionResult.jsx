import { formatMs } from '../../utils/missionChain.js'
import { Icon } from '../brand/Icon.jsx'

function Side({ label, side, tone }) {
  const done = side?.outcome === 'done'
  const gaveUp = side?.outcome === 'gave-up'
  const accent = tone === 'ember'
  return (
    <div className={`border-l-2 bg-white p-4 ${accent ? 'border-ember-600' : 'border-ink-900'}`}>
      <p className="eyebrow">{label}</p>
      {side ? (
        <>
          <p className={`num mt-2 font-mono text-4xl font-semibold ${accent ? 'text-ember-700' : 'text-ink-900'}`}>
            {side.durationMs != null ? formatMs(side.durationMs) : '–'}
          </p>
          <p className={`mt-2 inline-flex items-center gap-1.5 text-sm font-medium ${done ? 'text-ink-700' : gaveUp ? 'text-ember-700' : 'text-ink-500'}`}>
            <Icon name={done ? 'check' : gaveUp ? 'x' : 'clock'} size={16} />
            {done ? 'Did it' : gaveUp ? 'Gave up' : 'Ended without saying'}
          </p>
        </>
      ) : (
        <p className="mt-3 text-sm text-ink-500">Not run</p>
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
    <div className="mt-8 border-t border-rule pt-5">
      <p className="eyebrow">The mission</p>
      <p className="mt-1 text-xl font-medium text-ink-900">“{mission.goal}”</p>
      <div className={`mt-5 grid gap-3 ${you ? 'sm:grid-cols-2' : ''}`}>
        {you && <Side label="You" side={you} />}
        <Side label={`As ${who}`} side={as} tone="ember" />
      </div>
      {verdict && <p className="mt-4 text-lg font-semibold text-ember-700">{verdict}</p>}
    </div>
  )
}
