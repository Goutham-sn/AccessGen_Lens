import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../services/api.js'
import { loadChain, clearChain, formatMs } from '../utils/missionChain.js'
import { useExploreStart } from '../hooks/useExploreStart.js'
import { Logo } from '../components/brand/Logo.jsx'
import { Icon } from '../components/brand/Icon.jsx'
import { avatarColorFor } from '../data/personaCards.js'
import { getProfile } from '../data/profiles.js'

// Between the two runs of a mission: how it went as yourself, and the
// invitation to do exactly the same as the person.
export default function StepIn() {
  const { id } = useParams()
  const navigate = useNavigate()
  const explore = useExploreStart()
  const [chain] = useState(() => loadChain())
  const [baseline, setBaseline] = useState(null)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    if (!chain || chain.baselineSessionId !== id) { navigate(`/results/${id}`, { replace: true }); return }
    let tries = 0
    const load = () => api.get(`/sessions/${id}`).then((d) => {
      setBaseline(d.session)
      // The outcome can land a moment after the session ends.
      if (!d.session.mission?.outcome && tries++ < 5) setTimeout(load, 800)
    }).catch(() => {})
    load()
  }, [id, chain, navigate])

  if (!chain) return null
  const persona = chain.persona
  const who = persona?.name || 'them'
  const conditions = (chain.profiles || []).map((p) => getProfile(p.id)?.name || p.id).join(' · ')
  const m = baseline?.mission
  const yourTime = m?.outcome === 'done' ? formatMs(m.durationMs) : null

  async function stepIn() {
    setMessage(null)
    const result = await explore.start({
      url: chain.url, profiles: chain.profiles, persona: chain.persona, mission: chain.mission, baselineSessionId: id
    })
    if (result) setMessage(result)
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <header className="border-b border-rule">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-5"><Logo /></div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 py-16">
        <p className="eyebrow">Run 1 of 2 · as yourself</p>
        <p className="mt-3 text-lg text-ink-600">“{chain.mission.goal}”</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight text-ink-900 sm:text-5xl">
          {m?.outcome === 'done'
            ? <>You did it in <span className="num font-mono">{yourTime}</span>.</>
            : m?.outcome === 'gave-up'
            ? <>Even as yourself, you gave up.</>
            : <>That was you.</>}
        </h1>
        <p className="mt-4 max-w-xl text-lg text-ink-700">
          Now do exactly the same thing as {who}{persona?.age ? `, ${persona.age}` : ''}. Same page, same mission. Only the body changes.
        </p>

        <div className="mt-10 flex items-center gap-4 border-y border-rule py-5">
          <span aria-hidden="true" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-semibold text-ink-900"
            style={{ background: avatarColorFor(persona?.name) || '#e3e0d8' }}>
            {(persona?.name || '?').charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="text-lg font-semibold text-ink-900">{persona?.name ? `${persona.name}${persona.age ? `, ${persona.age}` : ''}` : 'With the simulation on'}</p>
            <p className="text-sm text-ink-600">{conditions}</p>
          </div>
        </div>

        {message && <p role="alert" className="mt-4 text-sm font-medium text-ember-700">{message}</p>}
        <div className="mt-8 flex flex-wrap items-center gap-5">
          <button type="button" onClick={stepIn} disabled={explore.starting}
            className="inline-flex min-h-[48px] items-center gap-2 rounded-[4px] bg-ink-900 px-6 font-medium text-paper hover:bg-ink-700 disabled:opacity-60">
            {explore.starting ? 'Opening…' : `Step into ${persona?.name ? `${persona.name}'s` : 'their'} world`} <Icon name="arrow" size={18} />
          </button>
          <Link to={`/results/${id}`} onClick={clearChain} className="text-sm text-ink-600 underline underline-offset-2 hover:text-ink-900">
            Not now, show my run
          </Link>
        </div>
      </main>
    </div>
  )
}
