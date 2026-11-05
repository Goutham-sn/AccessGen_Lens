import { Link, Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore.js'
import { PERSONA_CARDS } from '../data/personaCards.js'
import { teaserPeople, teaserLine } from '../utils/landingTeaser.js'
import { Logo } from '../components/brand/Logo.jsx'
import { Icon } from '../components/brand/Icon.jsx'
import { LiveLens } from '../components/landing/LiveLens.jsx'

function ReportPreview() {
  // A still of what a report opens with. Illustrative numbers, labelled so.
  return (
    <div className="card overflow-hidden" aria-label="Example of a report, with made-up numbers">
      <div className="bg-ink-950 p-6 text-white">
        <p className="eyebrow !text-white/50">Example report</p>
        <p className="mt-2 font-display text-2xl leading-snug">Meera nearly gave up on the checkout.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/5 p-3">
            <p className="text-xs text-white/50">You</p>
            <p className="font-display text-2xl">12 s</p>
          </div>
          <div className="rounded-xl bg-ember-500/15 p-3 ring-1 ring-ember-400/30">
            <p className="text-xs text-ember-200">As Meera</p>
            <p className="font-display text-2xl text-ember-200">3 min 41 s</p>
          </div>
        </div>
      </div>
      <div className="relative h-40 bg-[linear-gradient(180deg,#fafaf9,#f1f0ec)]">
        <div className="absolute left-6 top-5 h-3 w-24 rounded bg-stone-300" />
        <div className="absolute left-6 top-12 h-2 w-40 rounded bg-stone-200" />
        <div className="absolute left-6 top-20 grid w-[70%] grid-cols-3 gap-2">
          {[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-lg bg-stone-200" />)}
        </div>
        {[[34, 62], [70, 58], [48, 30]].map(([x, y], i) => (
          <span key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%` }} aria-hidden="true">
            <span className="absolute -left-3 -top-3 h-6 w-6 animate-pulse-ring rounded-full bg-ember-500/50" />
            <span className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-ember-600 ring-2 ring-white" />
          </span>
        ))}
      </div>
      <ul className="divide-y divide-black/5 text-sm">
        <li className="flex gap-3 p-4"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-ember-500" /><span><b className="font-semibold">“Could not find the price”</b><span className="block text-ink-500">Felt by the tester at 1:12, with a picture of that moment</span></span></li>
        <li className="flex gap-3 p-4"><span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-amber-500" /><span><b className="font-semibold">The shake made you miss “Add to basket”</b><span className="block text-ink-500">Noticed by the simulation: the button is 22 by 18 pixels</span></span></li>
      </ul>
    </div>
  )
}

export default function Landing() {
  const user = useAuthStore((s) => s.user)
  if (user) return <Navigate to="/dashboard" replace />
  const teaser = teaserPeople(PERSONA_CARDS)

  return (
    <div className="min-h-screen bg-paper">
      <a href="#main-content" className="skip-link">Skip to main content</a>

      <div className="relative overflow-hidden bg-ink-950 text-white">
        <div aria-hidden="true" className="grain pointer-events-none absolute inset-0" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-brand-600/30 blur-[120px]" />
        <div aria-hidden="true" className="pointer-events-none absolute -right-32 top-20 h-[420px] w-[420px] rounded-full bg-ember-500/20 blur-[120px]" />

        <header className="relative mx-auto flex h-16 max-w-7xl items-center justify-between px-5">
          <Logo dark />
          <nav aria-label="Account" className="flex items-center gap-2">
            <a href="#how" className="hidden rounded-full px-4 py-2 text-sm text-white/70 hover:text-white sm:inline">How it works</a>
            <Link to="/onboarding" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink-900 hover:bg-brand-50">Sign in</Link>
          </nav>
        </header>

        <main id="main-content" className="relative">
          <section className="mx-auto max-w-7xl px-5 pb-20 pt-14 sm:pt-20">
            <div className="max-w-3xl animate-fade-up">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-white/70">
                <span className="h-1.5 w-1.5 rounded-full bg-ember-400" /> An empathy engine for the web, not a checklist
              </p>
              <h1 className="mt-6 font-display text-5xl font-semibold leading-[1.02] sm:text-7xl">
                Don't read about it.<br /><span className="bg-gradient-to-r from-brand-300 via-[#c9b8ff] to-ember-300 bg-clip-text text-transparent">Feel it.</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-white/70">
                AccessGen Lens puts you inside someone else's eyes and hands on your own website: the shaking cursor,
                the blind spot in the middle of the page, the letters that will not stay still, the silence where a
                video should speak. Then it shows your whole team exactly where it broke.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link to="/onboarding" className="inline-flex min-h-[50px] items-center gap-2 rounded-full bg-white px-6 text-base font-semibold text-ink-900 hover:bg-brand-50">
                  Experience your site <Icon name="arrow" size={18} />
                </Link>
                <a href="#try" className="inline-flex min-h-[50px] items-center rounded-full border border-white/15 px-6 text-base font-medium text-white hover:bg-white/10">
                  Try it right here
                </a>
              </div>
            </div>

            <div id="try" className="mt-16 scroll-mt-8">
              <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ember-300">Live, in your browser</p>
                  <h2 className="mt-1 font-display text-3xl font-semibold">One small task. Seven different lives.</h2>
                </div>
                <p className="max-w-sm text-sm text-white/55">Do it as yourself, then as Ravi, Meera or David. Nothing to install. Nothing is recorded.</p>
              </div>
              <LiveLens />
            </div>
          </section>
        </main>
      </div>

      <section id="how" aria-labelledby="how-heading" className="mx-auto max-w-7xl px-5 py-24">
        <p className="eyebrow">Two ways in</p>
        <h2 id="how-heading" className="mt-2 max-w-2xl font-display text-4xl font-semibold text-ink-900">Watch them use your site, or become them.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {[
            { icon: 'play', title: 'Automated: watch it happen', body: 'Pick the people. Our own browser opens your page as each of them, moves through it the way they would, Tab by Tab, and records every stop. You get the video and the places they could not get past. No extension needed.' },
            { icon: 'hand', title: 'Manual: explore it yourself', body: 'Give yourself a mission, do it once as yourself, then again as Ravi or Meera. Your screen becomes theirs. Every misclick, every place focus vanished, every unnamed button is noticed for you, with a picture.' }
          ].map((c) => (
            <div key={c.title} className="card p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700"><Icon name={c.icon} /></span>
              <h3 className="mt-5 text-xl font-semibold text-ink-900">{c.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-600">{c.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="bring-heading" className="border-y border-black/5 bg-white">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-24 lg:grid-cols-2">
          <div>
            <p className="eyebrow">What you bring back</p>
            <h2 id="bring-heading" className="mt-2 font-display text-4xl font-semibold text-ink-900">A report nobody skims.</h2>
            <ul className="mt-8 space-y-6">
              {[
                ['clock', 'The number that ends the meeting', 'How long the mission took you, and how long it took as them. Or the moment they gave up.'],
                ['target', 'A map of where it hurt', 'Every struggle pinned to the page itself, so design and engineering see the exact spot.'],
                ['spark', 'Moments, not violations', 'What the tester felt, in their words, and what the simulation noticed on its own, each with a picture and the recording at that second.']
              ].map(([icon, t, b]) => (
                <li key={t} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ember-50 text-ember-700"><Icon name={icon} /></span>
                  <span><span className="block font-semibold text-ink-900">{t}</span><span className="text-ink-600">{b}</span></span>
                </li>
              ))}
            </ul>
          </div>
          <ReportPreview />
        </div>
      </section>

      <section aria-labelledby="people-heading" className="mx-auto max-w-7xl px-5 py-24">
        <p className="eyebrow">The people</p>
        <h2 id="people-heading" className="mt-2 font-display text-4xl font-semibold text-ink-900">Walk in their shoes.</h2>
        <p className="mt-3 max-w-xl text-ink-600">{teaserLine(PERSONA_CARDS, teaser.length)}</p>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {teaser.map((p) => (
            <li key={p.name} className="card p-6">
              <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full text-lg font-semibold text-ink-900" style={{ backgroundColor: p.color }}>
                {p.name.charAt(0)}
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold text-ink-900">{p.name}, {p.age}</h3>
              <p className="text-xs text-ink-500">{p.place}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{p.bio}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="px-5 pb-24">
        <div className="relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-ink-950 px-8 py-16 text-center text-white">
          <div aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-72 w-[60%] -translate-x-1/2 rounded-full bg-brand-600/30 blur-[100px]" />
          <h2 className="relative font-display text-4xl font-semibold sm:text-5xl">Ten minutes as someone else<br />changes what you build.</h2>
          <Link to="/onboarding" className="relative mt-8 inline-flex min-h-[50px] items-center gap-2 rounded-full bg-white px-7 text-base font-semibold text-ink-900 hover:bg-brand-50">
            Start your first experience <Icon name="arrow" size={18} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-black/5 py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 text-sm text-ink-500">
          <Logo />
          <span>An empathy engine, not a checklist. A simulation is never the same as a lived experience.</span>
        </div>
      </footer>
    </div>
  )
}
