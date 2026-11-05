import { SEVERITY_LABELS } from '../../data/profiles.js'

// Three-position severity control rendered as a radiogroup:
// keyboard operable, each option a ≥24px target.
export function SeveritySlider({ profileId, profileName, value, onChange }) {
  return (
    <fieldset className="mt-3">
      <legend className="sr-only">{profileName} severity</legend>
      <div role="radiogroup" aria-label={`${profileName} severity`} className="inline-flex rounded-lg border border-rule overflow-hidden">
        {[1, 2, 3].map((level) => {
          const selected = value === level
          return (
            <label
              key={level}
              className={`px-3 py-1.5 text-xs font-medium cursor-pointer select-none min-h-[28px] flex items-center
                ${selected ? 'bg-ink-900 text-white' : 'bg-white text-ink-700 hover:bg-paper'}
                ${level < 3 ? 'border-r border-rule' : ''}`}
            >
              <input
                type="radio"
                name={`severity-${profileId}`}
                value={level}
                checked={selected}
                onChange={() => onChange(level)}
                className="sr-only"
              />
              {SEVERITY_LABELS[level]}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
