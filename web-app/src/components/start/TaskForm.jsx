import { useEffect, useRef } from 'react'
import { Button } from '../shared/Button.jsx'

const INPUT = 'mt-1 w-full max-w-xl rounded-lg border border-gray-400 px-3 py-2 text-sm'

// The goal and the ordered things to find, for a run with something to find.
// value: { goal, intents: [text] }. limits: from GET /api/runs/capabilities
// (`task.limits`). error: null, or { message, field, at } where field is
// 'goal', 'intents' or the position of a step; a new `at` moves focus to the
// field that needs fixing.
export function TaskForm({ value, onChange, limits, error }) {
  const goalRef = useRef(null)
  const stepRefs = useRef([])
  const addRef = useRef(null)
  const focusAfter = useRef(null) // set by add and remove, used once the list has re-rendered

  const max = limits?.intents ?? 6
  const full = value.intents.length >= max

  // Focus follows the person's own action: a new step takes focus, and
  // removing one moves focus to its neighbour, never back to the page top.
  useEffect(() => {
    const target = focusAfter.current
    focusAfter.current = null
    if (target === null) return
    if (target === 'add') addRef.current?.focus()
    else stepRefs.current[target]?.focus()
  })

  // A new error moves focus to the field it is about.
  useEffect(() => {
    if (!error) return
    if (error.field === 'goal') goalRef.current?.focus()
    else if (error.field === 'intents') addRef.current?.focus()
    else stepRefs.current[error.field]?.focus()
  }, [error?.at]) // eslint-disable-line react-hooks/exhaustive-deps

  function setStep(i, text) {
    onChange({ ...value, intents: value.intents.map((t, j) => (j === i ? text : t)) })
  }

  function addStep() {
    if (full) return
    focusAfter.current = value.intents.length
    onChange({ ...value, intents: [...value.intents, ''] })
  }

  function removeStep(i) {
    if (value.intents.length <= 1) return
    focusAfter.current = Math.max(0, i - 1)
    onChange({ ...value, intents: value.intents.filter((_, j) => j !== i) })
  }

  const goalError = error?.field === 'goal' ? error.message : null
  const listError = error?.field === 'intents' ? error.message : null

  return (
    <section aria-labelledby="task-heading" className="mt-4 space-y-5 border-t border-rule pt-4">
      <div>
        <h3 id="task-heading" className="text-base font-semibold text-ink-900">What should they find?</h3>
        <p id="task-explain" className="mt-1 text-sm text-ink-700">
          Each person looks for the first thing, then for the next one from where they ended up. They use only the keys they
          can use. A run has a time limit, so keep the list short.
        </p>
      </div>

      <div>
        <label htmlFor="task-goal" className="block text-sm font-medium text-ink-900">Goal</label>
        <input
          id="task-goal"
          ref={goalRef}
          type="text"
          value={value.goal}
          onChange={(e) => onChange({ ...value, goal: e.target.value })}
          aria-describedby={`task-goal-hint${goalError ? ' task-goal-error' : ''}`}
          aria-invalid={goalError ? 'true' : undefined}
          placeholder="Buy the yearly plan"
          className={INPUT}
        />
        <p id="task-goal-hint" className="mt-1 text-sm text-ink-600">
          What the person came to do, in a short sentence. Up to {limits?.goalChars ?? 200} characters.
        </p>
        {goalError && <p id="task-goal-error" role="alert" className="mt-1 text-sm font-medium text-red-800">{goalError}</p>}
      </div>

      <fieldset aria-describedby={`task-steps-hint${listError ? ' task-steps-error' : ''}`}>
        <legend className="text-sm font-medium text-ink-900">Things to find, in order</legend>
        <p id="task-steps-hint" className="mt-1 text-sm text-ink-600">
          Write what each is called on the page, not where it is. For example: find pricing page, add item to cart, reach
          checkout form. {value.intents.length} of {max}.
        </p>
        <ol className="mt-3 space-y-3">
          {value.intents.map((text, i) => {
            const stepError = error?.field === i ? error.message : null
            const errorId = `task-step-${i}-error`
            return (
              <li key={i}>
                <label htmlFor={`task-step-${i}`} className="block text-sm text-ink-900">Step {i + 1}</label>
                <div className="flex flex-wrap items-start gap-2">
                  <input
                    id={`task-step-${i}`}
                    ref={(el) => { stepRefs.current[i] = el }}
                    type="text"
                    value={text}
                    onChange={(e) => setStep(i, e.target.value)}
                    aria-describedby={stepError ? errorId : undefined}
                    aria-invalid={stepError ? 'true' : undefined}
                    className={INPUT}
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    className="mt-1"
                    onClick={() => removeStep(i)}
                    disabled={value.intents.length <= 1}
                  >
                    Remove<span className="sr-only"> step {i + 1}</span>
                  </Button>
                </div>
                {stepError && <p id={errorId} role="alert" className="mt-1 text-sm font-medium text-red-800">{stepError}</p>}
              </li>
            )
          })}
        </ol>
        <div className="mt-3">
          <Button variant="secondary" ref={addRef} onClick={addStep} disabled={full} aria-describedby={full ? 'task-steps-full' : undefined}>
            Add a step
          </Button>
          {full && <p id="task-steps-full" className="mt-1 text-sm text-ink-700">You can list up to {max} things.</p>}
        </div>
        {listError && <p id="task-steps-error" role="alert" className="mt-2 text-sm font-medium text-red-800">{listError}</p>}
      </fieldset>
    </section>
  )
}
