import { stick } from './measuringStick.js'
import { detectChallenge } from './pageScripts.js'
import { cleanPageText } from './copy.js'

// Is the page itself a bot wall (a CAPTCHA or "are you human" page)? If it
// is, the run stops there and nothing is done to get past it.
//
// The rule: at least one sign of a challenge (a marker element, a frame from
// a CAPTCHA service, or a challenge title; see detectChallenge) AND almost
// no content of its own, which is all three of
//   - fewer than botWall.maxOwnTextChars characters of visible text
//   - no visible form field
//   - at most botWall.maxOwnControls visible links and buttons
// all counted outside the challenge parts. A page that merely embeds a
// CAPTCHA box or frame (a sign-up form, a news page) has content of its
// own, so it is looked at as usual.
//
// Returns { wall, evidence }. evidence is null when the page shows no sign
// (or could not be read); otherwise it holds which rules fired and what
// they saw, plus the HTTP status, for the run record.
export async function checkBotWall(page, status) {
  const seen = await page.evaluate(detectChallenge).catch(() => null)
  if (!seen || seen.rules.length === 0) return { wall: false, evidence: null }
  const almostNoContent = seen.textChars < stick('botWall', 'maxOwnTextChars') &&
    seen.fields === 0 && seen.controls <= stick('botWall', 'maxOwnControls')
  // The title is page text: cleaned like every other page-derived string.
  const evidence = { ...seen, title: cleanPageText(seen.title), status: status ?? null, almostNoContent }
  return { wall: almostNoContent, evidence }
}

// Which rules fired: "frame sign", "marker and frame signs",
// "marker, frame and title signs".
export function botWallRule(e) {
  const r = e.rules
  const words = r.length <= 1 ? r.join('') : `${r.slice(0, -1).join(', ')} and ${r[r.length - 1]}`
  return `${words} ${r.length === 1 ? 'sign' : 'signs'}`
}

// The evidence as one line, for the notes CSV and the console.
export function botWallEvidenceLine(e) {
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`
  return [
    `Rule: ${botWallRule(e)}, ${e.almostNoContent ? 'with almost no content of its own' : 'but the page has content of its own'}.`,
    `Marker: ${e.marker || 'none'}.`,
    `Frame host: ${e.frameHost == null ? 'none' : e.frameHost || 'unreadable'}.`,
    `Status: ${e.status ?? 'unknown'}.`,
    `Title: ${e.title ? `“${e.title}”` : 'none'}.`,
    `Own content: ${plural(e.textChars, 'character', 'characters')} of text, ${plural(e.fields, 'form field', 'form fields')}, ` +
      `${plural(e.controls, 'link or button', 'links and buttons')}.`
  ].join(' ')
}
