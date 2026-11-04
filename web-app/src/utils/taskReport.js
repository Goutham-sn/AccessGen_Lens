import { taskProgressLine } from './taskForm.js'

// What a report says about a task run: the goal, the things that were to be
// found in order, and which of them were reached. Read from the session as
// the report and the shared report receive it (`task`, and `coverage.task`
// from the run). Returns null for a session that had no task.
//
// A step is marked reached only when the run's own result says so and agrees
// with the stored list; otherwise nothing is marked, rather than guessed.
export function reportTask(session) {
  const t = session?.task
  if (!t || typeof t.goal !== 'string' || !Array.isArray(t.intents) || t.intents.length === 0) return null
  if (!t.intents.every((text) => typeof text === 'string')) return null

  const name = session.persona_snapshot?.name || 'This person'
  const c = session.coverage?.task
  const walked = Boolean(c) && Number.isInteger(c.reached) && Number.isInteger(c.intents) &&
    typeof c.ended === 'string' && c.intents === t.intents.length

  return {
    name,
    goal: t.goal,
    steps: t.intents.map((text, i) => ({ text, reached: walked ? i < c.reached : null })),
    progressLine: walked ? taskProgressLine(name, { reached: c.reached, intents: c.intents, ended: c.ended }) : null
  }
}
