import { reportTask } from '../../utils/taskReport.js'

// The goal and the things to find, in order, with which were reached. Shown
// near the top of a task run's report so the rest of it can be read: without
// it "reached 1 of 3" would not say what the 3 were. Renders nothing for a
// run that had no task. All text is shown as text, never as markup.
export function TaskList({ session, headingLevel = 2, idPrefix = 'task' }) {
  const task = reportTask(session)
  if (!task) return null
  const H = `h${headingLevel}`
  const size = headingLevel === 2 ? 'text-xl' : 'text-base'
  return (
    <section aria-labelledby={`${idPrefix}-heading`} className="card p-6">
      <H id={`${idPrefix}-heading`} className={`${size} font-semibold text-ink-900`}>
        What {task.name} was looking for
      </H>
      <p className="mt-2 text-ink-700">Goal: {task.goal}</p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-ink-900">
        {task.steps.map((step, i) => (
          <li key={i}>
            {step.text}
            {step.reached === true && <span className="ml-2 text-sm font-medium text-ink-700">Reached</span>}
          </li>
        ))}
      </ol>
      {task.progressLine && <p className="mt-3 text-sm font-medium text-ink-900">{task.progressLine}</p>}
    </section>
  )
}
