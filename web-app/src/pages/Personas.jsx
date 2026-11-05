import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper.jsx'
import { PersonaCard } from '../components/simulator/PersonaCard.jsx'
import { Button } from '../components/shared/Button.jsx'
import { Modal } from '../components/shared/Modal.jsx'
import { PROFILES, getProfile } from '../data/profiles.js'
import { PERSONA_CARDS } from '../data/personaCards.js'
import { inCardOrder } from '../utils/personaRecord.js'
import { useProfileStore } from '../store/profileStore.js'
import { api } from '../services/api.js'

function CreatePersonaModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState({ name: '', age: '', story: '' })
  const [selected, setSelected] = useState({}) // id -> severity
  const [error, setError] = useState(null)
  const [saving, setSaving] = useState(false)

  function toggle(id) {
    setSelected((s) => {
      const next = { ...s }
      if (next[id]) delete next[id]
      else next[id] = 2
      return next
    })
  }

  async function submit(e) {
    e.preventDefault()
    const profiles = Object.entries(selected).map(([id, severity]) => ({ id, severity }))
    if (!form.name || profiles.length === 0) {
      setError('Give your persona a name and at least one profile.')
      return
    }
    setSaving(true)
    try {
      const data = await api.post('/personas', {
        name: form.name,
        age: form.age ? Number(form.age) : null,
        story: form.story,
        profiles
      })
      onCreated(data.persona)
      onClose()
      setForm({ name: '', age: '', story: '' })
      setSelected({})
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Create a persona" wide>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_120px]">
          <div>
            <label htmlFor="p-name" className="block text-sm font-medium text-ink-700 mb-1">Name</label>
            <input id="p-name" type="text" value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full rounded-lg border border-rule px-3 py-2 text-sm" />
          </div>
          <div>
            <label htmlFor="p-age" className="block text-sm font-medium text-ink-700 mb-1">Age</label>
            <input id="p-age" type="number" min="1" max="120" value={form.age}
              onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
              className="w-full rounded-lg border border-rule px-3 py-2 text-sm" />
          </div>
        </div>
        <div>
          <label htmlFor="p-story" className="block text-sm font-medium text-ink-700 mb-1">
            Their story <span className="text-ink-500 font-normal">(who are they, and how do they use the web?)</span>
          </label>
          <textarea id="p-story" rows={3} value={form.story}
            onChange={(e) => setForm((f) => ({ ...f, story: e.target.value }))}
            className="w-full rounded-lg border border-rule px-3 py-2 text-sm" />
        </div>
        <fieldset>
          <legend className="text-sm font-medium text-ink-700 mb-2">Profiles they live with</legend>
          <div className="grid gap-2 sm:grid-cols-2 max-h-64 overflow-y-auto pr-1">
            {PROFILES.map((p) => (
              <label key={p.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer
                ${selected[p.id] ? 'border-brand-400 bg-brand-50' : 'border-rule'}`}>
                <input
                  type="checkbox"
                  checked={Boolean(selected[p.id])}
                  onChange={() => toggle(p.id)}
                  className="h-4 w-4"
                />
                {p.name}
              </label>
            ))}
          </div>
        </fieldset>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create persona'}</Button>
        </div>
      </form>
    </Modal>
  )
}

export default function Personas() {
  const navigate = useNavigate()
  const applyPersona = useProfileStore((s) => s.applyPersona)
  const [people, setPeople] = useState(null) // every record from the server
  const [loadFailed, setLoadFailed] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  useEffect(() => {
    api.get('/personas')
      .then((d) => setPeople(d.personas || []))
      .catch(() => setLoadFailed(true))
  }, [])

  const builtIn = inCardOrder((people || []).filter((p) => p.is_built_in), PERSONA_CARDS)
  const custom = (people || []).filter((p) => !p.is_built_in)

  // A built-in person is on /start with their full card: they are chosen there
  // (or shown, if they can only be explored).
  function selectBuiltIn(persona) {
    navigate('/start', { state: { personaName: persona.name } })
  }

  // A custom person has no card on /start. Their conditions go to /configure.
  function selectCustom(persona) {
    applyPersona({
      id: persona.id,
      name: persona.name,
      age: persona.age,
      story: persona.story,
      profiles: persona.profiles,
      illustrationColor: persona.illustrationColor
    })
    navigate('/configure')
  }

  async function removeCustom(id) {
    if (!window.confirm('Delete this persona?')) return
    await api.delete(`/personas/${id}`)
    setPeople((all) => all.filter((p) => p.id !== id))
  }

  return (
    <PageWrapper
      title="Personas"
      actions={<Button onClick={() => setCreateOpen(true)}>Create persona</Button>}
    >
      <p className="text-ink-600 mb-8 max-w-2xl">
        A persona is a person, not a setting. Pick a built-in person to watch or explore a page as
        them, or create your own and pick them to explore with their whole combination of conditions.
      </p>

      <section aria-labelledby="builtin-heading" className="mb-10">
        <h2 id="builtin-heading" className="text-lg font-medium text-ink-900 mb-4">Built-in</h2>
        {loadFailed && <p role="alert" className="mb-4 text-sm font-medium text-red-800">We could not load the people right now. Please reload the page.</p>}
        {!loadFailed && !people && <p className="mb-4 text-sm text-ink-600">Loading people…</p>}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {builtIn.map((p) => (
            <PersonaCard key={p.id} persona={p} onSelect={selectBuiltIn} />
          ))}
        </div>
      </section>

      <section aria-labelledby="custom-heading">
        <h2 id="custom-heading" className="text-lg font-medium text-ink-900 mb-4">Yours</h2>
        {custom.length === 0 ? (
          <p className="text-sm text-ink-500">
            No custom personas yet. Create one based on your real users.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {custom.map((p) => (
              <div key={p.id} className="relative">
                <PersonaCard persona={p} onSelect={selectCustom} />
                <button
                  type="button"
                  onClick={() => removeCustom(p.id)}
                  aria-label={`Delete persona ${p.name}`}
                  className="absolute top-2 right-2 rounded-md bg-white/90 border border-rule px-2 py-1 text-xs text-ink-600 hover:text-red-800 hover:border-red-300"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <CreatePersonaModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(p) => setPeople((all) => [p, ...(all || [])])}
      />
    </PageWrapper>
  )
}
