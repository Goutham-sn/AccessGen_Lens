import { useEffect, useState } from 'react'
import { splitFirstSentence } from '../../utils/cardSummary.js'

const SEEN_KEY = 'accessgen.start.introSeen'

function seenBefore() {
  try { return localStorage.getItem(SEEN_KEY) === '1' } catch { return false }
}

// The shared intro (text from the backend, see SimulationBanner) for the start
// page: in full the first time someone is here, then one line with a
// "What is this?" button for the rest.
export function StartIntro({ text }) {
  const [open, setOpen] = useState(() => !seenBefore())

  useEffect(() => {
    try { localStorage.setItem(SEEN_KEY, '1') } catch { /* storage unavailable */ }
  }, [])

  if (!text) return null
  const { first, rest } = splitFirstSentence(text)

  return (
    <section aria-label="About this simulation" className="rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-ink-900">
      <p className="text-sm leading-relaxed">
        {first}
        {rest && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls="start-intro-more"
            onClick={() => setOpen((o) => !o)}
            className="ml-2 inline-flex min-h-[24px] items-center gap-1 rounded-md text-sm font-medium text-brand-700 underline"
          >
            What is this?<span aria-hidden="true">{open ? '▴' : '▾'}</span>
          </button>
        )}
      </p>
      {rest && <p id="start-intro-more" hidden={!open} className="mt-1 text-sm leading-relaxed">{rest}</p>}
    </section>
  )
}
