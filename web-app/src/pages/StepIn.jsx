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
    if (!chain || chain.baselineSessionId !== id) { navigate(`/playback/${id}`, { replace: true }); return }
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
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-ink-950 text-white">
      <div aria-hidden="true" className="grain pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="pointer-events-none absolute -left-32 -top-32 h-[460px] w-[460px] rounded-full bg-brand-600/30 blur-[120px]" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -right-20 h-[420px] w-[420px] rounded-full bg-ember-500/20 blur-[120px]" />
      <header className="relative mx-auto flex h-16 w-full max-w-5xl items-center px-5"><Logo dark /></header>
      <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-5 pb-20 animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-300">Run one of two, as yourself</p>
        <p className="mt-3 font-display text-2xl text-white/70">“{chain.mission.goal}”</p>
        <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.05] sm:text-6xl">
          {m?.outcome === 'done'
            ? <>You did it in <span className="text-brand-300">{yourTime}</span>.</>
            : m?.outcome === 'gave-up'
            ? <>Even as yourself, you gave up.</>
            : <>That was you.</>}
        </h1>
        <p className="mt-5 max-w-xl text-lg text-white/70">
          Now do exactly the same thing as {who}{persona?.age ? `, ${persona.age}` : ''}. Same page, same mission. Only the body changes.
        </p>

        <div className="mt-10 flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <span aria-hidden="true" className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-xl font-semibold text-ink-900"
            style={{ background: avatarColorFor(persona?.name) || '#d1ccff' }}>
            {(persona?.name || '?').charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="font-display text-xl font-semibold">{persona?.name ? `${persona.name}${persona.age ? `, ${persona.age}` : ''}` : 'With the simulation on'}</p>
            <p className="text-sm text-white/60">{conditions}</p>
          </div>
        </div>

        {message && <p role="alert" className="mt-4 text-sm font-medium text-ember-300">{message}</p>}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <button type="button" onClick={stepIn} disabled={explore.starting}
            className="inline-flex min-h-[54px] items-center gap-2 rounded-full bg-white px-7 text-base font-semibold text-ink-900 hover:bg-brand-50 disabled:opacity-60">
            {explore.starting ? 'Opening…' : `Step into ${persona?.name ? `${persona.name}'s` : 'their'} world`} <Icon name="arrow" size={18} />
          </button>
          <Link to={`/playback/${id}`} onClick={clearChain} className="text-sm text-white/60 underline hover:text-white">
            Not now, show my run
          </Link>
        </div>
      </main>
    </div>
  )
}
