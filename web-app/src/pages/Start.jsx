import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper.jsx'
import { Button } from '../components/shared/Button.jsx'
import { SimulationBanner } from '../components/start/SimulationBanner.jsx'
import { PersonaCardFull } from '../components/start/PersonaCardFull.jsx'
import { PERSONA_CARDS, CARD_SECTIONS, cardTitle, getCard } from '../data/personaCards.js'
import { BUILT_IN_PERSONAS } from '../data/personas.js'
import { api } from '../services/api.js'
import { useExtension } from '../hooks/useExtension.js'
import { useExploreStart, normalizeUrl } from '../hooks/useExploreStart.js'

const MAX_WATCH = 4

// How each condition reads in "Explore applies Ravi's tremor only".
const CONDITION_WORDS = { tremor: 'tremor', dyslexia: 'dyslexia', adhd: 'ADHD', deaf: 'hearing loss' }
const STORE_KEY = 'accessgen.start.v1'

// Choices survive a reload and the back button. The "allowed to test"
// confirmation is deliberately not kept: it is given again for every run.
function loadSaved() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE_KEY) || '{}')
    const automated = new Set(PERSONA_CARDS.filter((c) => c.mode === 'automated').map((c) => c.id))
    return {
      url: typeof saved.url === 'string' ? saved.url : '',
      chosen: Array.isArray(saved.chosen) ? saved.chosen.filter((id) => automated.has(id)).slice(0, MAX_WATCH) : [],
      open: Array.isArray(saved.open) ? saved.open.filter((id) => getCard(id)) : []
    }
  } catch {
    return { url: '', chosen: [], open: [] }
  }
}

export default function Start() {
  const navigate = useNavigate()
  const { installed } = useExtension()
  const explore = useExploreStart()

  const initial = useMemo(loadSaved, [])
  const [url, setUrl] = useState(initial.url)
  const [chosen, setChosen] = useState(initial.chosen)
  const [open, setOpen] = useState(initial.open)
  const [allowed, setAllowed] = useState(false)
  const [caps, setCaps] = useState(null)
  const [dbPersonas, setDbPersonas] = useState(null)
  const [loadMessage, setLoadMessage] = useState(null)
  const [watchMessage, setWatchMessage] = useState(null)
  const [exploreMessage, setExploreMessage] = useState(null)
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ url, chosen, open })) } catch { /* storage unavailable */ }
  }, [url, chosen, open])

  useEffect(() => {
    let cancelled = false
    Promise.all([api.get('/runs/capabilities'), api.get('/personas')])
      .then(([c, p]) => {
        if (cancelled) return
        setCaps(c)
        setDbPersonas(p.personas || [])
      })
      .catch(() => { if (!cancelled) setLoadMessage('We could not check what can run right now. Please reload the page.') })
    return () => { cancelled = true }
  }, [])

  // A check is live for a card when any of the card's profiles runs it today.
  function isLiveFor(card) {
    return (check) => Boolean(caps) && card.profiles.some((p) => caps.capabilities?.[p.id]?.checks?.[check] === true)
  }

  // From the persona record; unset or not a persona means they/them/their.
  function pronounsFor(card) {
    return dbPersonas?.find((p) => p.is_built_in && p.name === card.personaName)?.pronouns || null
  }

  function unavailableReason(card) {
    if (!caps) return 'Checking what can run…'
    const missing = card.profiles.filter((p) => !caps.capabilities?.[p.id])
    return missing.length ? 'Not available right now.' : null
  }

  function toggleChosen(id) {
    setWatchMessage(null)
    setChosen((c) => {
      if (c.includes(id)) return c.filter((x) => x !== id)
      if (c.length >= MAX_WATCH) {
        setWatchMessage(`You can watch up to ${MAX_WATCH} people at once.`)
        return c
      }
      return [...c, id]
    })
  }

  function toggleDetails(id) {
    setOpen((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]))
  }

  async function startWatching() {
    setWatchMessage(null)
    const target = normalizeUrl(url)
    if (!target) return setWatchMessage('Enter the address of the page you want to watch.')
    if (chosen.length === 0) return setWatchMessage('Choose at least one person to watch.')
    if (!allowed) return setWatchMessage('Please confirm you are allowed to test this site.')
    const ids = chosen.map((id) => dbPersonas?.find((p) => p.is_built_in && p.name === getCard(id).personaName)?.id)
    if (ids.some((x) => !x)) return setWatchMessage('We could not find one of the chosen people. Please reload the page.')

    setStarting(true)
    try {
      const run = await api.post('/runs', { url: target, personaIds: ids })
      navigate(`/run/${run.runId}`)
    } catch (err) {
      setWatchMessage(err.message)
      setStarting(false)
    }
  }

  async function startExploring(card) {
    setExploreMessage(null)
    if (installed === false) {
      setExploreMessage('The Chrome extension is not detected, so exploring cannot start yet.')
      return
    }
    const persona = BUILT_IN_PERSONAS.find((p) => p.name === card.personaName) || null
    const message = await explore.start({ url, profiles: card.profiles, persona })
    if (message) setExploreMessage(message)
  }

  const bySection = Object.fromEntries(CARD_SECTIONS.map((s) => [s.mode, PERSONA_CARDS.filter((c) => c.mode === s.mode)]))
  const summary = chosen.length === 0
    ? 'No one chosen to watch yet.'
    : `${chosen.length} ${chosen.length === 1 ? 'person' : 'people'} chosen to watch: ${chosen.map((id) => cardTitle(getCard(id))).join('; ')}.`

  return (
    <PageWrapper title="Choose how to experience a page">
      <a href="#choices" className="skip-link">Skip to the choices</a>

      <div className="space-y-6">
        <SimulationBanner text={caps?.intro} />
        {loadMessage && <p role="alert" className="text-sm font-medium text-red-800">{loadMessage}</p>}

        <nav aria-label="Sections on this page">
          <h2 className="text-sm font-semibold text-ink-900">On this page</h2>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {CARD_SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-block min-h-[24px] text-brand-700 underline">
                  {s.title}, {bySection[s.mode].length} cards
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <label htmlFor="start-url" className="block text-sm font-medium text-ink-900">Page address</label>
          <input
            id="start-url"
            type="text"
            inputMode="url"
            autoComplete="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            aria-describedby="start-url-hint"
            className="mt-1 w-full max-w-xl rounded-lg border border-gray-400 px-3 py-2 text-sm"
          />
          <p id="start-url-hint" className="mt-1 text-sm text-ink-600">
            Public pages only. We never sign in, click, type or submit anything.
          </p>
        </div>

        <p role="status" className="text-sm text-ink-900">{summary}</p>

        <div id="choices" className="space-y-10">
          {/* Automated */}
          <section id="section-automated" aria-labelledby="section-automated-heading">
            <h2 id="section-automated-heading" className="text-xl font-semibold text-ink-900">
              {CARD_SECTIONS[0].title}, {bySection.automated.length} cards
            </h2>
            <p className="mt-1 text-sm text-ink-700">
              A browser on our side moves through the page as each person you choose, and records it. Choose up to {MAX_WATCH}.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {bySection.automated.map((card) => {
                const reason = unavailableReason(card)
                return (
                  <PersonaCardFull
                    key={card.id}
                    card={card}
                    pronouns={pronounsFor(card)}
                    isLive={isLiveFor(card)}
                    detailsOpen={open.includes(card.id)}
                    onToggleDetails={() => toggleDetails(card.id)}
                    unavailableReason={reason}
                  >
                    <label className="flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-ink-900 hover:border-brand-500">
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={chosen.includes(card.id)}
                        onChange={() => toggleChosen(card.id)}
                        disabled={Boolean(reason)}
                        aria-describedby={reason ? `${card.id}-unavailable` : undefined}
                      />
                      <span>Watch {cardTitle(card)}</span>
                      {chosen.includes(card.id) && <span className="ml-auto text-xs text-ink-700">Chosen</span>}
                    </label>
                  </PersonaCardFull>
                )
              })}
            </div>

            <div className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-sm text-ink-900">{summary}</p>
              <label className="flex min-h-[44px] items-center gap-3 text-sm text-ink-900">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={allowed}
                  onChange={(e) => setAllowed(e.target.checked)}
                />
                <span>I'm allowed to test this site.</span>
              </label>
              {watchMessage && <p role="alert" className="text-sm font-medium text-red-800">{watchMessage}</p>}
              <Button onClick={startWatching} disabled={starting}>
                {starting ? 'Starting…' : 'Start watching'}
              </Button>
            </div>
          </section>

          {/* Extension */}
          <section id="section-extension" aria-labelledby="section-extension-heading">
            <h2 id="section-extension-heading" className="text-xl font-semibold text-ink-900">
              {CARD_SECTIONS[1].title}, {bySection.extension.length} cards
            </h2>
            <p className="mt-1 text-sm text-ink-700">
              You move through the page yourself with the Chrome extension, and we record it.
            </p>
            {installed === false && (
              <p id="extension-missing" className="mt-2 text-sm font-medium text-ink-900">
                The Chrome extension is not detected. Load it from extension/dist at chrome://extensions, then reload this page.
              </p>
            )}
            {exploreMessage && <p role="alert" className="mt-2 text-sm font-medium text-red-800">{exploreMessage}</p>}
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {bySection.extension.map((card) => {
                const appliesId = `${card.id}-applies`
                const names = card.profiles.map((p) => CONDITION_WORDS[p.id] || p.id.replace(/-/g, ' '))
                return (
                  <PersonaCardFull
                    key={card.id}
                    card={card}
                    pronouns={pronounsFor(card)}
                    isLive={() => true}
                    detailsOpen={open.includes(card.id)}
                    onToggleDetails={() => toggleDetails(card.id)}
                  >
                    <p id={appliesId} className="mb-2 text-sm text-ink-700">
                      Explore applies {card.name}'s {names.join(' and ')} only. Other conditions stay off.
                    </p>
                    <Button
                      onClick={() => startExploring(card)}
                      disabled={explore.starting}
                      aria-describedby={installed === false ? `${appliesId} extension-missing` : appliesId}
                    >
                      Explore as {cardTitle(card)}
                    </Button>
                  </PersonaCardFull>
                )
              })}
            </div>
            <p className="mt-4 text-sm">
              <Link to="/configure" className="text-brand-700 underline">Or choose conditions yourself</Link>
            </p>
          </section>

          {/* Later */}
          <section id="section-later" aria-labelledby="section-later-heading">
            <h2 id="section-later-heading" className="text-xl font-semibold text-ink-900">
              {CARD_SECTIONS[2].title}, {bySection.later.length} cards
            </h2>
            <p className="mt-1 text-sm text-ink-700">
              Experiences we cannot simulate yet. They are here so you can keep them in mind.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {bySection.later.map((card) => (
                <PersonaCardFull key={card.id} card={card} isLive={() => false} pronouns={pronounsFor(card)} />
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageWrapper>
  )
}
