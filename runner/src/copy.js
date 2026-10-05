// Words the runner puts on screen and in moments. Third person, plain words,
// no verdicts. Detector templates (Phase 3) live here too.

// How each filter profile reads in a sentence.
const CONDITION_WORDS = {
  deuteranopia: 'red-green colour blindness',
  achromatopsia: 'colour blindness',
  'low-vision': 'low vision'
}

// The caption line shown while the persona's filter is paused for a moment,
// or null when the persona has no filter on the page.
export function pauseNote(name, profiles) {
  const words = (profiles || []).map((p) => CONDITION_WORDS[p.id]).filter(Boolean)
  if (!name || words.length === 0) return null
  return `Showing the page without ${name}'s ${words.join(' and ')} so it is readable.`
}
