// The "something to find" form on /start: what is checked before a run is
// asked for, and the words that change when a run has something to find.
// Pure, so it can be tested without a browser. The server checks the same
// rules again (backend/src/utils/taskInput.js); the limits come from
// GET /api/runs/capabilities (`task.limits`), never from here.

const UNSAFE = /[\p{Cc}\p{Cf}]/u
const HAS_WORD = /[\p{L}\p{N}]/u

export const emptyTask = () => ({ on: false, goal: '', intents: [''] })

const tidy = (value) => String(value ?? '').replace(/\s+/g, ' ').trim()

// What was kept in the browser for this form, with anything unexpected left
// out. The chosen limits are applied when the form is checked, not here.
export function loadTask(saved) {
  const base = emptyTask()
  if (!saved || typeof saved !== 'object') return base
  const intents = Array.isArray(saved.intents) ? saved.intents.filter((t) => typeof t === 'string').slice(0, 20) : []
  return {
    on: saved.on === true,
    goal: typeof saved.goal === 'string' ? saved.goal.slice(0, 1000) : '',
    intents: intents.length ? intents : base.intents
  }
}

// Checks the form. Returns { task: { goal, intents } } or
// { error, field }, where field is 'goal', 'intents' (the list as a whole)
// or the position of the thing that needs fixing. Rows left empty are
// ignored.
export function checkTaskForm({ goal, intents }, limits) {
  if (!limits) return { error: 'We could not check what a run can take yet. Please reload the page.', field: 'goal' }
  const cleanGoal = tidy(goal)
  if (!cleanGoal || !HAS_WORD.test(cleanGoal) || UNSAFE.test(cleanGoal)) {
    return { error: 'Write the goal in plain words, for example "Buy the yearly plan".', field: 'goal' }
  }
  if (cleanGoal.length > limits.goalChars) {
    return { error: `Keep the goal to ${limits.goalChars} characters or fewer.`, field: 'goal' }
  }
  const kept = []
  for (let i = 0; i < intents.length; i++) {
    const text = tidy(intents[i])
    if (!text) continue
    if (text.length > limits.intentChars) {
      return { error: `Keep each thing to ${limits.intentChars} characters or fewer.`, field: i }
    }
    if (UNSAFE.test(text) || !HAS_WORD.test(text)) {
      return { error: 'Write each thing in plain words, with at least one letter or number.', field: i }
    }
    kept.push(text)
  }
  if (kept.length === 0) return { error: 'Add at least one thing to find.', field: 'intents' }
  if (kept.length > limits.intents) return { error: `You can list up to ${limits.intents} things.`, field: 'intents' }
  return { task: { goal: cleanGoal, intents: kept } }
}

// Whether a person can take part when there is something to find: one of
// their profiles decides how the page is reached (`taskProfiles` from the
// server).
export function canFindThings(profileIds, taskProfiles) {
  return Array.isArray(taskProfiles) && profileIds.some((id) => taskProfiles.includes(id))
}

// Said instead of a card's usual "what this run looks at" and "not looked at"
// lists when the run has something to find, because the checks in those lists
// do not run then. `name` is the person's name; profileIds are theirs.
export function taskCardLines(name, profileIds) {
  const looks = [`Whether ${name} can reach each thing on your list, in order, using only Tab and, on a link or button, Enter`]
  if (profileIds.includes('screen-reader')) {
    looks.push('Only what a screen reader would announce about each place')
  } else if (profileIds.includes('tunnel-vision')) {
    looks.push(`Only what can be made out near the middle of the screen and near the place ${name} was just at`)
  } else {
    looks.push(`The words on the page, as ${name} would read them`)
  }
  const not = [
    'Typing, signing in, or sending a form. A run with something to find never does these.',
    'The other checks: where focus is hard to see, loops, and names a screen reader cannot hear. They do not run when there is something to find.'
  ]
  return { looks, not }
}

// One line on how far a person got, or null when there is nothing to say: the
// walk never ran, or everything was reached (the run page already says so).
// progress: { reached, intents, ended } from the run.
export function taskProgressLine(name, progress) {
  if (!progress || progress.ended === null || progress.reached >= progress.intents) return null
  if (progress.intents === 1) return `${name} did not reach the thing on the list.`
  if (progress.reached === 0) return `${name} did not reach any of the ${progress.intents} things on the list.`
  return `${name} reached ${progress.reached} of ${progress.intents} things on the list.`
}
