import { getProfile } from '../../data/profiles.js'
import { personCard } from '../../data/personaCards.js'
import { Badge } from '../shared/Badge.jsx'

export function PersonaCard({ persona, onSelect, selected = false }) {
  const initial = persona.name?.charAt(0)?.toUpperCase() || '?'
  // A built-in person's place and colour are on their /start card.
  const card = persona.is_built_in ? personCard(persona.name) : null
  const color = persona.illustrationColor || card?.avatarColor || '#dbe6fe'
  const location = persona.location || card?.place

  return (
    <button
      type="button"
      onClick={() => onSelect?.(persona)}
      aria-pressed={selected}
      className={`text-left rounded-xl border p-4 w-full transition-colors
        ${selected ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white hover:border-brand-300'}`}
    >
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-ink-900"
          style={{ backgroundColor: color }}
        >
          {initial}
        </span>
        <div>
          <span className="font-medium text-ink-900">
            {persona.name}{persona.age ? `, ${persona.age}` : ''}
          </span>
          {location && <p className="text-xs text-ink-500">{location}</p>}
        </div>
      </div>
      <p className="mt-3 text-sm text-ink-600 line-clamp-3">{persona.story}</p>
      <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={`${persona.name}'s profiles`}>
        {(persona.profiles || []).map((p) => {
          const profile = getProfile(p.id)
          return profile ? (
            <li key={p.id}><Badge tone="neutral">{profile.name}</Badge></li>
          ) : null
        })}
      </ul>
    </button>
  )
}
