import { BUILT_IN_PERSONAS } from '../../data/personas.js'
import { useProfileStore } from '../../store/profileStore.js'
import { PersonaCard } from './PersonaCard.jsx'

export function PersonaPicker() {
  const { persona, applyPersona } = useProfileStore()

  return (
    <section aria-labelledby="persona-picker-heading">
      <h2 id="persona-picker-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-500 mb-1">
        Or walk in someone's shoes
      </h2>
      <p className="text-sm text-ink-600 mb-4">
        Each persona loads a real combination of conditions, drawn from a life story.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BUILT_IN_PERSONAS.map((p) => (
          <PersonaCard
            key={p.id}
            persona={p}
            selected={persona?.id === p.id}
            onSelect={applyPersona}
          />
        ))}
      </div>
    </section>
  )
}
