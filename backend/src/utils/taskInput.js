import { TASK_LIMITS } from '../config/runnerCapabilities.js'

// Task Mode input: { goal, intents: [text, ...] } from a person, checked
// before anything is stored or queued. Text is plain: whitespace collapsed,
// no control or invisible formatting characters (they could hide or reorder
// what the report shows).
//
// Returns { task: null } when no task was asked for, { task } with the
// cleaned task, or { error } in plain words for the person.
const UNSAFE = /[\p{Cc}\p{Cf}]/u
const HAS_WORD = /[\p{L}\p{N}]/u

function cleanText(value, max) {
  if (typeof value !== 'string') return null
  const text = value.replace(/\s+/g, ' ').trim()
  if (!text || text.length > max || UNSAFE.test(text) || !HAS_WORD.test(text)) return null
  return text
}

export function checkTask(raw) {
  if (raw === undefined || raw === null) return { task: null }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { error: 'Describe what to look for as a short goal and a list of things to find.' }
  }
  const { goalChars, intents: maxIntents, intentChars } = TASK_LIMITS
  const goal = cleanText(raw.goal, goalChars)
  if (!goal) return { error: `Write the goal in plain words, up to ${goalChars} characters.` }
  if (!Array.isArray(raw.intents) || raw.intents.length < 1 || raw.intents.length > maxIntents) {
    return { error: `List between 1 and ${maxIntents} things to find, in order.` }
  }
  const intents = raw.intents.map((text) => cleanText(text, intentChars))
  if (intents.some((text) => text === null)) {
    return { error: `Write each thing to find in plain words, up to ${intentChars} characters.` }
  }
  return { task: { goal, intents } }
}
