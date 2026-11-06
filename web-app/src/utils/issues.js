// Sorting a session's moments into the kinds of issue the results page
// lists. Pure functions, so they are tested without a browser.

// The page audit's data: the extension stores it as the moment's evidence,
// the runner under evidence.measured.
export function auditOf(m) {
  if (m?.evidence?.audit) return m.evidence
  if (m?.evidence?.measured?.audit) return m.evidence.measured
  return null
}

const IMPACT_RANK = { critical: 0, serious: 1, moderate: 2, minor: 3 }

export function splitMoments(moments = []) {
  const audit = []
  const review = []
  const seen = []
  const felt = []
  for (const m of moments) {
    const a = auditOf(m)
    if (a) (a.review ? review : audit).push(m)
    else if (m.source === 'extension-auto' || m.source === 'runner') seen.push(m)
    else felt.push(m)
  }
  const byImpact = (x, y) => (IMPACT_RANK[auditOf(x).impact] ?? 9) - (IMPACT_RANK[auditOf(y).impact] ?? 9) || (auditOf(y).count || 0) - (auditOf(x).count || 0)
  audit.sort(byImpact)
  review.sort(byImpact)
  return { audit, review, seen, felt }
}

const LEVEL_A_AA = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22a', 'wcag22aa']

// A moment the results page shows: not something left to check by hand,
// and for a rules finding, only WCAG A and AA (sessions recorded before the
// audit was limited to those may hold AAA and best-practice findings).
export function isShownMoment(m) {
  const a = auditOf(m)
  if (!a) return !/^Check by hand/.test(m?.headline || m?.label || '')
  if (a.review) return false
  const tags = a.tags || []
  return !tags.length || tags.some((t) => LEVEL_A_AA.includes(t))
}

// The moments to list, in the order they happened.
export function listMoments(moments = []) {
  return moments
    .filter(isShownMoment)
    .map((m, i) => ({ m, i }))
    .sort((x, y) => (x.m.timestamp_ms ?? Infinity) - (y.m.timestamp_ms ?? Infinity) || x.i - y.i)
    .map(({ m }) => m)
}

export function issueCounts(moments = []) {
  const { audit, review, seen, felt } = splitMoments(moments)
  return {
    issues: audit.length + seen.length,
    elements: audit.reduce((s, m) => s + (auditOf(m).count || 1), 0) + seen.reduce((s, m) => s + (m.pattern_count || 1), 0),
    felt: felt.length,
    review: review.length
  }
}

// Who an issue hurts, in words, by condition id.
export const PEOPLE_WORDS = {
  'screen-reader': 'screen reader users',
  'keyboard-only': 'keyboard users',
  'switch-access': 'switch users',
  'low-vision': 'people with low vision',
  cataracts: 'people with cataracts',
  deuteranopia: 'colour-blind people',
  protanopia: 'colour-blind people',
  tritanopia: 'colour-blind people',
  tremor: 'people with a tremor',
  dyslexia: 'people with dyslexia',
  adhd: 'people with ADHD',
  deaf: 'Deaf people',
  'voice-control': 'voice control users'
}
