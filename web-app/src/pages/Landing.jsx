import { Link, Navigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuthStore } from '../store/authStore.js'
import { Navbar } from '../components/layout/Navbar.jsx'
import { PERSONA_CARDS } from '../data/personaCards.js'
import { teaserPeople, teaserLine } from '../utils/landingTeaser.js'

export default function Landing() {
  const user = useAuthStore((s) => s.user)
  const reduceMotion = useReducedMotion()
  if (user) return <Navigate to="/dashboard" replace />
  const teaser = teaserPeople(PERSONA_CARDS)

  const fadeUp = reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.5 } }

  return (
    <div className="min-h-screen bg-white">
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <Navbar />
      <main id="main-content">
        <section className="mx-auto max-w-4xl px-4 pt-20 pb-16 text-center">
          <motion.h1 {...fadeUp} className="text-4xl sm:text-5xl font-semibold text-ink-900 leading-tight">
            Feel your website the way<br className="hidden sm:block" /> someone else has to.
          </motion.h1>
          <motion.p {...fadeUp} className="mt-6 text-lg text-ink-600 max-w-2xl mx-auto">
            AccessGen Lens is not an audit tool. It won't show you checklists or violations.
            It puts you inside the experience of a person with a disability (the shaking cursor,
            the vanishing periphery, the silence where a video should speak) on your real website.
          </motion.p>
          <motion.div {...fadeUp} className="mt-10 flex justify-center gap-3">
            <Link
              to="/onboarding"
              className="rounded-lg bg-brand-700 px-6 py-3 text-white font-medium hover:bg-brand-800 min-h-[48px] inline-flex items-center"
            >
              Start experiencing
            </Link>
            <a
              href="#how-it-works"
              className="rounded-lg border border-gray-300 px-6 py-3 text-ink-700 font-medium hover:bg-gray-50 min-h-[48px] inline-flex items-center"
            >
              How it works
            </a>
          </motion.div>
        </section>

        <section id="how-it-works" aria-labelledby="how-heading" className="bg-gray-50 py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 id="how-heading" className="text-2xl font-semibold text-ink-900 text-center">
              Three steps to empathy
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              {[
                ['Choose a life', 'Pick disability profiles, or step into a persona like Meera, 72, with macular degeneration and a tremor.'],
                ['Use your site', 'The Chrome extension transforms the real page. You browse it exactly as they would, and it is harder than you think.'],
                ['Share the feeling', 'Every struggle is recorded into a video and a human-language report your whole team can feel.']
              ].map(([title, body], i) => (
                <div key={title} className="rounded-2xl bg-white border border-gray-200 p-6">
                  <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-700 text-white text-sm font-semibold">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-semibold text-ink-900">{title}</h3>
                  <p className="mt-2 text-sm text-ink-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section aria-labelledby="personas-heading" className="py-16">
          <div className="mx-auto max-w-5xl px-4">
            <h2 id="personas-heading" className="text-2xl font-semibold text-ink-900 text-center">
              Walk in their shoes
            </h2>
            <p className="mt-3 text-center text-ink-600 max-w-xl mx-auto">
              {teaserLine(PERSONA_CARDS, teaser.length)}
            </p>
            <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {teaser.map((p) => (
                <li key={p.name} className="rounded-2xl border border-gray-200 p-5">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 items-center justify-center rounded-full font-semibold text-ink-900"
                    style={{ backgroundColor: p.color }}
                  >
                    {p.name.charAt(0)}
                  </span>
                  <h3 className="mt-3 font-medium text-ink-900">{p.name}, {p.age}</h3>
                  <p className="text-xs text-ink-500">{p.place}</p>
                  <p className="mt-1 text-sm text-ink-600">{p.bio}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <footer className="border-t border-gray-200 py-8 text-center text-sm text-ink-500">
        AccessGen Lens: an empathy engine, not a checklist.
      </footer>
    </div>
  )
}
