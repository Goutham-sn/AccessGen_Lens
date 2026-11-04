// What the pre-check says on a card, and above the cards. It counts what is on
// the page for a person's way of using it; it never says whether anything is
// done well, so there are no verdict words and no guideline numbers here, and
// a note is about how much there is for that person to meet.

// The signals that say something to a card, from the profiles a run of that
// card uses. signals: { 'signal-id': [profile ids] } from
// GET /api/runs/capabilities.
export function signalsForCard(profileIds, signals) {
  return Object.entries(signals || {})
    .filter(([, profiles]) => profiles.some((p) => profileIds.includes(p)))
    .map(([id]) => id)
}

// About how many words: the characters over six, to the nearest ten, never
// claiming less than ten.
const wordsIn = (chars) => Math.max(10, Math.round(chars / 6 / 10) * 10)

// One sentence for a signal, or null when there is nothing to say (the page has
// plenty of it, or the look was not sure). Each is about what is on the page.
const SENTENCES = {
  'reachable-stops': (name, r) => {
    const { count, level } = r.reachableStops || {}
    if (level === 'none') return `On this page, ${name} would have nothing to land on with Tab: no link, button or field can be reached.`
    if (level === 'few') return `On this page, ${name} would find few places to land on with Tab: only ${count === 1 ? 'one' : count}.`
    return null
  },
  'text-amount': (name, r) => {
    const { chars, level } = r.textAmount || {}
    if (level === 'none') return `On this page, ${name} would find almost no text to read.`
    if (level === 'little') return `On this page, ${name} would find little text to read: about ${wordsIn(chars)} words.`
    return null
  },
  'colour-change': (name, r) => {
    if (r.colourChange?.level !== 'little') return null
    return `On this page, little changes in the colours ${name} sees: nearly everything on screen looks the same as it does to other people.`
  },
  // Graded by how many places sit out of view (the middle band says nothing).
  // Both numbers are in the sentence, so what "little" and "a lot" mean on this
  // page is plain.
  'unseen-stops': (name, r) => {
    const { count, of, level } = r.unseenStops || {}
    if (level === 'none') {
      return `On this page, ${name} would be able to make out every place Tab lands on: each is near the middle of the screen or near the last place.`
    }
    if (level === 'few') {
      const where = of === 1 ? 'the one place Tab reaches sits' : `only ${count} of the ${of} places Tab reaches ${count === 1 ? 'sits' : 'sit'}`
      return `On this page, ${name} would have little to miss: ${where} out of view.`
    }
    if (level === 'lots') return `On this page, ${name} would have a lot to miss: ${count} of ${of} places Tab reaches sit out of view.`
    return null
  }
}

// The notes for a card, in a fixed order: [{ signal, text }]. result is the
// pre-check result for the address in the field.
export function precheckNotes(name, profileIds, signals, result) {
  if (!result?.ok) return []
  const mine = signalsForCard(profileIds, signals)
  return Object.keys(SENTENCES)
    .filter((signal) => mine.includes(signal))
    .map((signal) => ({ signal, text: SENTENCES[signal](name, result) }))
    .filter((n) => n.text)
}

// The line above the cards. `state` is { status: 'idle' | 'checking' | 'done', result }.
export function precheckStatusLine(state) {
  if (state?.status === 'checking') return 'Checking this page…'
  if (state?.status !== 'done') return null
  return state.result?.ok ? 'Checked this page ahead of time.' : state.result?.reason || 'We could not check this page ahead of time.'
}
