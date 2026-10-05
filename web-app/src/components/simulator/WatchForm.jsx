import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../shared/Button.jsx'
import { api } from '../../services/api.js'
import { MAX_RUN_PERSONAS, runnerSupports, unsupportedReason } from '../../data/runner.js'

// "Watch it happen": a browser on our side visits the page as each chosen
// person and records it. Personas whose experience it cannot simulate yet
// are shown, but disabled, with the reason in plain words.
export function WatchForm({ url, setUrl, onCancel }) {
  const navigate = useNavigate()
  const [personas, setPersonas] = useState(null)
  const [chosen, setChosen] = useState([])
  const [allowed, setAllowed] = useState(false)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    api.get('/personas')
      .then((d) => { if (!cancelled) setPersonas(d.personas || []) })
      .catch(() => { if (!cancelled) setError('We could not load the people to choose from. Please try again.') })
    return () => { cancelled = true }
  }, [])

  function toggle(id) {
    setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    let target = url.trim()
    if (!target) { setError('Enter the address of the page you want to watch.'); return }
    if (!/^https?:\/\//i.test(target)) target = `https://${target}`
    if (chosen.length === 0) { setError('Choose at least one person to follow.'); return }
    if (chosen.length > MAX_RUN_PERSONAS) { setError(`Choose up to ${MAX_RUN_PERSONAS} people.`); return }
    if (!allowed) { setError('Please confirm you are allowed to test this site.'); return }

    setStarting(true)
    try {
      const run = await api.post('/runs', { url: target, personaIds: chosen })
      navigate(`/run/${run.runId}`)
    } catch (err) {
      setError(err.message)
      setStarting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="watch-url" className="block text-sm font-medium text-ink-700 mb-1">
          Page address
        </label>
        <input
          id="watch-url"
          type="text"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-ink-600">Public pages only. We never sign in, click, type or submit anything.</p>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-ink-700 mb-2">Who should we follow?</legend>
        {personas === null && !error && <p className="text-sm text-ink-600">Loading people…</p>}
        <ul className="space-y-2">
          {(personas || []).map((p) => {
            const supported = runnerSupports(p)
            const reasonId = `persona-reason-${p.id}`
            return (
              <li key={p.id}>
                <label
                  className={`flex min-h-[44px] items-start gap-3 rounded-lg border px-3 py-2 text-sm
                    ${supported ? 'border-gray-300 cursor-pointer hover:border-brand-500' : 'border-gray-200 bg-gray-50'}`}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4"
                    checked={chosen.includes(p.id)}
                    onChange={() => toggle(p.id)}
                    disabled={!supported}
                    aria-describedby={supported ? undefined : reasonId}
                  />
                  <span>
                    <span className={`font-medium ${supported ? 'text-ink-900' : 'text-ink-600'}`}>
                      {p.name}{p.age ? `, ${p.age}` : ''}
                    </span>
                    {!supported && (
                      <span id={reasonId} className="block text-xs text-ink-600">{unsupportedReason(p)}</span>
                    )}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      </fieldset>

      <label className="flex min-h-[44px] items-start gap-3 text-sm text-ink-800">
        <input
          type="checkbox"
          className="mt-1 h-4 w-4"
          checked={allowed}
          onChange={(e) => setAllowed(e.target.checked)}
        />
        <span>I'm allowed to test this site.</span>
      </label>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={starting}>
          {starting ? 'Starting…' : 'Start watching'}
        </Button>
      </div>
    </form>
  )
}
