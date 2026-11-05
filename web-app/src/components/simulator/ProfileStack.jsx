import { useProfileStore } from '../../store/profileStore.js'
import { getProfile, describeCombination, SEVERITY_LABELS } from '../../data/profiles.js'
import { Badge } from '../shared/Badge.jsx'

// The right-hand "what you're about to experience" panel.
export function ProfileStack() {
  const { activeProfiles, persona, toggleProfile, clearAll } = useProfileStore()

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-ink-900">Your experience</h2>
        {activeProfiles.length > 0 && (
          <button
            type="button"
            onClick={clearAll}
            className="text-sm font-medium text-ink-600 hover:text-ink-900 rounded px-1"
          >
            Clear all
          </button>
        )}
      </div>

      {persona && (
        <p className="mt-2 text-sm text-brand-800 bg-brand-50 rounded-lg px-3 py-2">
          Walking in <strong>{persona.name}</strong>'s shoes
          {persona.age ? `, ${persona.age}` : ''}
        </p>
      )}

      <ul className="mt-3 flex flex-wrap gap-2" aria-label="Selected profiles">
        {activeProfiles.map((ap) => {
          const p = getProfile(ap.id)
          if (!p) return null
          return (
            <li key={ap.id}>
              <Badge>
                {p.name}
                {p.hasSeverity && ` · ${SEVERITY_LABELS[ap.severity]}`}
                <button
                  type="button"
                  aria-label={`Remove ${p.name}`}
                  onClick={() => toggleProfile(ap.id, p.hasSeverity)}
                  className="ml-1 rounded-full hover:bg-brand-100 px-1"
                >
                  ×
                </button>
              </Badge>
            </li>
          )
        })}
        {activeProfiles.length === 0 && (
          <li className="text-sm text-ink-500">Nothing selected yet.</li>
        )}
      </ul>

      <p aria-live="polite" className="mt-4 text-sm leading-relaxed text-ink-700 border-t border-gray-100 pt-4">
        {describeCombination(activeProfiles)}
      </p>
    </div>
  )
}
