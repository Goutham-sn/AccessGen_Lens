import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { PageWrapper } from '../components/layout/PageWrapper.jsx'
import { Button } from '../components/shared/Button.jsx'
import { StartIntro } from '../components/start/StartIntro.jsx'
import { PersonaCardFull } from '../components/start/PersonaCardFull.jsx'
import { TaskForm } from '../components/start/TaskForm.jsx'
import { landingFor } from '../utils/personaLanding.js'
import { usePrecheck } from '../hooks/usePrecheck.js'
import { precheckNotes, precheckStatusLine } from '../utils/precheckNotes.js'
import { emptyTask, loadTask, checkTaskForm, canFindThings, taskCardLines } from '../utils/taskForm.js'
import { PERSONA_CARDS, CARD_SECTIONS, cardTitle, getCard } from '../data/personaCards.js'
import { api } from '../services/api.js'
import { useExtension } from '../hooks/useExtension.js'
import { useExploreStart, normalizeUrl } from '../hooks/useExploreStart.js'

const MAX_WATCH = 4

function isWebUrl(raw) {
  try { return /^https?:$/.test(new URL(raw).protocol) } catch { return false }
}

// How each condition reads in "Explore applies Ravi's tremor only".
const CONDITION_WORDS = {
  tremor: 'tremor', dyslexia: 'dyslexia', adhd: 'ADHD', deaf: 'hearing loss',
  'switch-access': 'switch access', cataracts: 'cataracts and glare', protanopia: 'protanopia'
}
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
      open: Array.isArray(saved.open) ? saved.open.filter((id) => getCard(id)) : [],
      task: loadTask(saved.task)
    }
  } catch {
    return { url: '', chosen: [], open: [], task: emptyTask() }
  }
}

export default function Start() {
  const navigate = useNavigate()
  const location = useLocation()
  const { installed } = useExtension()
  const explore = useExploreStart()

  const initial = useMemo(loadSaved, [])
  const [url, setUrl] = useState(initial.url)
  const [chosen, setChosen] = useState(initial.chosen)
  const [open, setOpen] = useState(initial.open)
  const [task, setTask] = useState(initial.task)
  const [taskError, setTaskError] = useState(null)
  const [taskNotice, setTaskNotice] = useState(null)
  const [allowed, setAllowed] = useState(false)
  const [caps, setCaps] = useState(null)
  const [dbPersonas, setDbPersonas] = useState(null)
  const [loadMessage, setLoadMessage] = useState(null)
  const [watchMessage, setWatchMessage] = useState(null)
  const [exploreMessage, setExploreMessage] = useState(null)
  const [starting, setStarting] = useState(false)
  const precheck = usePrecheck()
  // A built-in person picked on the Personas page (read once, then cleared).
  const landingName = useRef(location.state?.personaName ?? null)
  const [landed, setLanded] = useState(null) // { cardId, action } once applied, for moving focus
  // Which of the two ways to experience a page is shown: 'automated' (we
  // walk the page as the person) or 'extension' (you drive it yourself).
  const [mode, setMode] = useState(() => (location.hash === '#manual' ? 'extension' : 'automated'))

  useEffect(() => {
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify({ url, chosen, open, task })) } catch { /* storage unavailable */ }
  }, [url, chosen, open, task])

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

  // The profile ids of the persona behind a card, as the server has them.
  function profileIdsFor(card) {
    const persona = dbPersonas?.find((p) => p.is_built_in && p.name === card.personaName)
    return persona ? (persona.profiles || []).map((p) => p.id) : card.profiles.map((p) => p.id)
  }

  // With something to find, a person needs a profile that decides how the page
  // is reached (the server says which).
  function cannotFindThings(card) {
    return task.on && Boolean(caps) && Boolean(dbPersonas) && !canFindThings(profileIdsFor(card), caps.task?.profiles)
  }

  function unavailableReason(card) {
    if (!caps) return 'Checking what can run…'
    const missing = card.profiles.filter((p) => !caps.capabilities?.[p.id])
    if (missing.length) return 'Not available right now.'
    if (cannotFindThings(card)) return `${card.name}'s experience is not covered yet when there is something to find.`
    return null
  }

  function toggleTask(on) {
    setTask((t) => ({ ...t, on }))
    setTaskError(null)
    setTaskNotice(null)
    setWatchMessage(null)
    if (!on) return
    // Anyone already chosen who cannot take part is taken off, and it is said.
    const dropped = chosen.filter((id) => !canFindThings(profileIdsFor(getCard(id)), caps?.task?.profiles))
    if (dropped.length === 0) return
    setChosen((c) => c.filter((id) => !dropped.includes(id)))
    const names = dropped.map((id) => getCard(id).name)
    const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0]
    setTaskNotice(`${list} cannot take part when there is something to find, so ${names.length > 1 ? 'they are' : 'this person is'} no longer chosen.`)
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

  // The quick look at the page starts when the confirmation is given, never
  // from typing. Changing the address or taking the confirmation back retires it.
  useEffect(() => {
    if (!allowed || (precheck.state.url && precheck.state.url !== normalizeUrl(url))) precheck.reset()
  }, [allowed, url]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (allowed && isWebUrl(normalizeUrl(url))) precheck.check(normalizeUrl(url))
  }, [allowed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Arriving from the Personas page: choose the person, or show their card.
  useEffect(() => {
    const name = landingName.current
    if (!name || !caps || !dbPersonas) return
    landingName.current = null
    navigate(location.pathname, { replace: true, state: null }) // a reload or back does not repeat it
    const found = landingFor(name, PERSONA_CARDS, (card) => !unavailableReason(card))
    if (!found) return
    let { action } = found
    if (action === 'choose' && !chosen.includes(found.cardId) && chosen.length >= MAX_WATCH) {
      setWatchMessage(`You can watch up to ${MAX_WATCH} people at once. Take someone off to choose ${name}.`)
      action = 'show'
    }
    if (action === 'choose') setChosen((c) => (c.includes(found.cardId) ? c : [...c, found.cardId]))
    else setOpen((o) => (o.includes(found.cardId) ? o : [...o, found.cardId]))
    const landedCard = getCard(found.cardId)
    if (landedCard?.mode === 'automated' || landedCard?.mode === 'extension') setMode(landedCard.mode)
    setLanded({ cardId: found.cardId, action })
  }, [caps, dbPersonas]) // eslint-disable-line react-hooks/exhaustive-deps

  // Bring the card into view and put focus on what was just done: the choice,
  // or the Details button that was opened.
  useEffect(() => {
    if (!landed) return
    const card = document.getElementById(`card-${landed.cardId}`)
    const target = card?.querySelector(landed.action === 'choose' ? 'input[type="checkbox"]' : 'button[aria-expanded]')
    card?.scrollIntoView({ block: 'center' })
    target?.focus({ preventScroll: true })
  }, [landed])

  async function startWatching() {
    setWatchMessage(null)
    setTaskError(null)
    const target = normalizeUrl(url)
    if (!target) return setWatchMessage('Enter the address of the page you want to watch.')
    let taskBody = null
    if (task.on) {
      const checked = checkTaskForm(task, caps?.task?.limits)
      if (checked.error) return setTaskError({ message: checked.error, field: checked.field, at: Date.now() })
      taskBody = checked.task
    }
    if (chosen.length === 0) return setWatchMessage('Choose at least one person to watch.')
    if (!allowed) return setWatchMessage('Please confirm you are allowed to test this site.')
    const ids = chosen.map((id) => dbPersonas?.find((p) => p.is_built_in && p.name === getCard(id).personaName)?.id)
    if (ids.some((x) => !x)) return setWatchMessage('We could not find one of the chosen people. Please reload the page.')

    setStarting(true)
    try {
      const run = await api.post('/runs', { url: target, personaIds: ids, ...(taskBody ? { task: taskBody } : {}) })
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
    const persona = dbPersonas?.find((p) => p.is_built_in && p.name === card.personaName)
    if (!persona) {
      setExploreMessage('We could not find this person yet. Please reload the page.')
      return
    }
    const message = await explore.start({ url, profiles: card.profiles, persona })
    if (message) setExploreMessage(message)
  }

  const target = normalizeUrl(url)
  const looked = precheck.state.url === target ? precheck.state : null // the look is for the address in the field
  const lookedLine = precheckStatusLine(looked)
  const canLookAgain = allowed && isWebUrl(target) && (!looked || (looked.status === 'done' && !looked.result?.ok))
  const bySection = Object.fromEntries(CARD_SECTIONS.map((s) => [s.mode, PERSONA_CARDS.filter((c) => c.mode === s.mode)]))
  const summary = chosen.length === 0
    ? 'No one chosen to watch yet.'
    : `${chosen.length} ${chosen.length === 1 ? 'person' : 'people'} chosen to watch: ${chosen.map((id) => cardTitle(getCard(id))).join('; ')}.`

  return (
    <PageWrapper title="Choose how to experience a page">
      <a href="#choices" className="skip-link">Skip to the choices</a>

      <div className="space-y-6">
        <StartIntro text={caps?.intro} />
        {loadMessage && <p role="alert" className="text-sm font-medium text-red-800">{loadMessage}</p>}

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
            {mode === 'extension'
              ? 'Any page you can open in Chrome, including ones behind your own sign-in. You do the clicking and typing.'
              : task.on
              ? 'Public pages only. We press Tab, and Enter on a link to a page on the same site or on a button that does not send a form. We never sign in, type or send a form.'
              : 'Public pages only. We never sign in, click, type or submit anything.'}
          </p>
          <label className="mt-2 flex min-h-[44px] items-center gap-3 text-sm text-ink-900">
            <input
              type="checkbox"
              id="start-allowed"
              className="h-5 w-5"
              checked={allowed}
              onChange={(e) => setAllowed(e.target.checked)}
            />
            <span>I'm allowed to test this site.</span>
          </label>
          <div className="flex flex-wrap items-center gap-3">
            {canLookAgain && (
              <Button variant="secondary" size="sm" onClick={() => precheck.check(target)}>
                {looked ? 'Check this page again' : 'Check this page ahead of time'}
              </Button>
            )}
            {lookedLine && <p id="precheck-status" role="status" className="text-sm text-ink-800">{lookedLine}</p>}
          </div>
        </div>

        <fieldset>
          <legend className="text-sm font-medium text-ink-900">How do you want to experience it?</legend>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {[
              {
                value: 'automated',
                title: 'Automated: watch it happen',
                text: 'We open the page in our own browser as the people you choose, move through it the way they would, record it, and report what stopped them. No extension needed.'
              },
              {
                value: 'extension',
                title: 'Manual: explore it yourself',
                text: 'The page opens in your browser with the conditions switched on. You try to use it, feel where it fights you, and get a recording and a report.'
              }
            ].map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer gap-3 rounded-xl border-2 p-4 transition-colors ${
                  mode === opt.value ? 'border-brand-600 bg-brand-50' : 'border-gray-200 bg-white hover:border-brand-300'
                }`}
              >
                <input
                  type="radio"
                  name="start-mode"
                  value={opt.value}
                  checked={mode === opt.value}
                  onChange={() => setMode(opt.value)}
                  className="mt-1 h-5 w-5 shrink-0"
                />
                <span>
                  <span className="block font-semibold text-ink-900">{opt.title}</span>
                  <span className="mt-1 block text-sm text-ink-700">{opt.text}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        {mode === 'automated' && <p role="status" className="text-sm text-ink-900">{summary}</p>}

        <div id="choices" className="space-y-10">
          {/* Automated */}
          <section id="section-automated" aria-labelledby="section-automated-heading" hidden={mode !== 'automated'}>
            <h2 id="section-automated-heading" className="text-xl font-semibold text-ink-900">
              {CARD_SECTIONS[0].title}
            </h2>
            <p className="mt-1 text-sm text-ink-700">
              A browser on our side moves through the page as each person you choose, and records it. Choose up to {MAX_WATCH}.
            </p>

            <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
              <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm font-medium text-ink-900">
                <input
                  type="checkbox"
                  id="task-on"
                  className="h-5 w-5"
                  checked={task.on}
                  onChange={(e) => toggleTask(e.target.checked)}
                  aria-describedby="task-on-hint"
                />
                <span>Give them something to find</span>
              </label>
              <p id="task-on-hint" className="text-sm text-ink-700">
                Instead of going through every stop, each person looks for the things you list, in order. This does not
                apply to "Manual: explore it yourself".
              </p>
              {taskNotice && <p role="status" className="mt-2 text-sm font-medium text-ink-900">{taskNotice}</p>}
              {task.on && <TaskForm value={task} onChange={(next) => setTask((t) => ({ ...t, ...next }))} limits={caps?.task?.limits} error={taskError} />}
            </div>
            <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
              {bySection.automated.map((card) => {
                const reason = unavailableReason(card)
                // A run with something to find simulates the person's whole combination
                // (tunnel vision included); a regular run, only what the card runs.
                const notes = looked?.status === 'done' && !reason
                  ? precheckNotes(card.name, task.on ? profileIdsFor(card) : card.profiles.map((p) => p.id), caps?.precheck?.signals, looked.result)
                  : []
                const describedBy = [reason && `${card.id}-unavailable`, ...notes.map((n) => `${card.id}-precheck-${n.signal}`)].filter(Boolean).join(' ') || undefined
                return (
                  <PersonaCardFull
                    key={card.id}
                    card={card}
                    pronouns={pronounsFor(card)}
                    precheckNotes={notes}
                    isLive={isLiveFor(card)}
                    detailsOpen={open.includes(card.id)}
                    onToggleDetails={() => toggleDetails(card.id)}
                    unavailableReason={reason}
                    taskLines={task.on ? taskCardLines(card.name, profileIdsFor(card)) : null}
                  >
                    <label
                      className={`flex min-h-[44px] items-center gap-3 rounded-lg border px-3 py-2 text-sm font-medium ${
                        reason
                          ? 'cursor-not-allowed border-gray-200 bg-gray-100 text-ink-600 opacity-60'
                          : 'cursor-pointer border-gray-300 text-ink-900 hover:border-brand-500'
                      }`}
                    >
                      <input
                        type="checkbox"
                        className="h-5 w-5 disabled:cursor-not-allowed"
                        checked={chosen.includes(card.id)}
                        onChange={() => toggleChosen(card.id)}
                        disabled={Boolean(reason)}
                        aria-describedby={describedBy}
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
              {watchMessage && <p role="alert" className="text-sm font-medium text-red-800">{watchMessage}</p>}
              <Button onClick={startWatching} disabled={starting}>
                {starting ? 'Starting…' : 'Start watching'}
              </Button>
            </div>
          </section>

          {/* Extension */}
          <section id="section-extension" aria-labelledby="section-extension-heading" hidden={mode !== 'extension'}>
            <h2 id="section-extension-heading" className="text-xl font-semibold text-ink-900">
              {CARD_SECTIONS[1].title}
            </h2>
            <p className="mt-1 text-sm text-ink-700">
              You move through the page yourself with the Chrome extension. The screen is recorded from the first
              second, and the simulation notes on its own where the page pushes back. Press "I felt this" on the page
              whenever it does.
            </p>
            {installed === false && (
              <p id="extension-missing" className="mt-2 text-sm font-medium text-ink-900">
                The Chrome extension is not detected. Load it from extension/dist at chrome://extensions, then reload this page.
              </p>
            )}
            {exploreMessage && <p role="alert" className="mt-2 text-sm font-medium text-red-800">{exploreMessage}</p>}
            <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
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
              <Link to="/configure" className="text-brand-700 underline">Or choose and combine conditions yourself</Link>
            </p>
          </section>

          {/* Later */}
          <details id="section-later" className="group rounded-xl border border-dashed border-gray-300 bg-white/60 p-4">
            <summary className="cursor-pointer text-base font-semibold text-ink-900">
              {CARD_SECTIONS[2].title} ({bySection.later.length})
            </summary>
            <p className="mt-1 text-sm text-ink-700">
              Experiences we cannot simulate yet. They are here so you can keep them in mind.
            </p>
            <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
              {bySection.later.map((card) => (
                <PersonaCardFull
                  key={card.id}
                  card={card}
                  isLive={() => false}
                  pronouns={pronounsFor(card)}
                  detailsOpen={open.includes(card.id)}
                  onToggleDetails={() => toggleDetails(card.id)}
                />
              ))}
            </div>
          </details>
        </div>
      </div>
    </PageWrapper>
  )
}
