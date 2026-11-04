// Splits a paragraph into its first sentence and the rest, so a card can show
// one line by default and keep the rest behind "Details". A sentence ends at
// ". ", "! " or "? "; text with no such break is all "first".
export function splitFirstSentence(text) {
  const s = String(text ?? '').trim()
  const m = /^(.*?[.!?])\s+(\S[\s\S]*)$/.exec(s)
  return m ? { first: m[1], rest: m[2] } : { first: s, rest: '' }
}
