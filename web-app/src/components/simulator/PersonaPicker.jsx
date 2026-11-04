import { useEffect, useState } from 'react'
import { PERSONA_CARDS } from '../../data/personaCards.js'
import { useProfileStore } from '../../store/profileStore.js'
import { api } from '../../services/api.js'
import { inCardOrder } from '../../utils/personaRecord.js'
import { PersonaCard } from './PersonaCard.jsx'

export function PersonaPicker() {
  const { persona, applyPersona } = useProfileStore()
  const [people, setPeople] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    api.get('/personas')
      .then((d) => { if (!cancelled) setPeople(inCardOrder((d.personas || []).filter((p) => p.is_built_in), PERSONA_CARDS)) })
      .catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [])

  return (
    <section aria-labelledby="persona-picker-heading">
      <h2 id="persona-picker-heading" className="text-sm font-semibold uppercase tracking-wide text-ink-500 mb-1">
        Or walk in someone's shoes
      </h2>
      <p className="text-sm text-ink-600 mb-4">
        Each persona loads a real combination of conditions, drawn from a life story.
      </p>
      {failed && <p role="alert" className="text-sm font-medium text-red-800">We could not load the people right now. Please reload the page.</p>}
      {!failed && !people && <p className="text-sm text-ink-600">Loading people…</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(people || []).map((p) => (
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
