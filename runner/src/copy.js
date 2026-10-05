// Words the runner puts on screen and in moments. Third person, plain words,
// no verdicts. Detector templates (Phase 3) live here too.

// How each filter profile reads in a sentence.
const CONDITION_WORDS = {
  deuteranopia: 'red-green colour blindness',
  achromatopsia: 'colour blindness',
  'low-vision': 'low vision'
}

const MAX_PAGE_TEXT = 80
// Control characters (C0 and C1), and the bidirectional overrides and
// isolates that can make text display in a different order than it reads.
const UNSAFE_CHARS = /[\u0000-\u001F\u007F-\u009F‎‏‪-‮⁦-⁩]/g

// Any text taken from the page under test (an accessible name, the name of
// something covering an element): control characters removed, whitespace
// collapsed, at most 80 characters. It is always shown as text, never as
// markup; escaping is the job of whatever renders it.
export function cleanPageText(raw) {
  const text = String(raw ?? '').replace(UNSAFE_CHARS, ' ').replace(/\s+/g, ' ').trim()
  return text.length > MAX_PAGE_TEXT ? `${text.slice(0, MAX_PAGE_TEXT - 1)}…` : text
}

// A page-derived name ready for a sentence: cleaned, or "an unnamed
// {role}" when there is nothing to show.
export function pageName(raw, role) {
  const text = cleanPageText(raw)
  return text || `an unnamed ${cleanPageText(role) || 'element'}`
}

// The caption line shown while the persona's filter is paused for a moment,
// or null when the persona has no filter on the page.
export function pauseNote(name, profiles) {
  const words = (profiles || []).map((p) => CONDITION_WORDS[p.id]).filter(Boolean)
  if (!name || words.length === 0) return null
  return `Showing the page without ${name}'s ${words.join(' and ')} so it is readable.`
}
