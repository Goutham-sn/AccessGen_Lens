import { splitFirstSentence } from './cardSummary.js'

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
const word = (n) => WORDS[n] ?? String(n)
const capital = (w) => w.charAt(0).toUpperCase() + w.slice(1)

// The line above the teaser: says how many of the built-in people are shown,
// so it stays true when the number shown or the number of people changes.
export function teaserLine(cards, shown) {
  const total = new Set(cards.filter((c) => c.kind === 'person' && c.personaName).map((c) => c.personaName)).size
  if (shown >= total) return `${capital(word(total))} people, ${word(total)} very different ways of experiencing the same page.`
  return `${capital(word(shown))} of the ${word(total)} people you can choose, each experiencing the same page very differently.`
}

// The people shown on the landing page, taken from the /start cards (no copy
// of their own): one per person, in card order, with name, age, place and the
// card's one-line bio. The landing page is shown before anyone signs in, so
// the person's pronouns are not known there. A bio that needs them is skipped
// rather than shown with a different pronoun from the one on /start.
export function teaserPeople(cards, count = 4) {
  const seen = new Set()
  const out = []
  for (const c of cards) {
    if (c.kind !== 'person' || !c.personaName || seen.has(c.personaName)) continue
    seen.add(c.personaName)
    const { first } = splitFirstSentence(c.story)
    if (/\{\w+\}/.test(first)) continue
    out.push({ name: c.personaName, age: c.age, place: c.place, bio: first, color: c.avatarColor })
    if (out.length === count) break
  }
  return out
}
