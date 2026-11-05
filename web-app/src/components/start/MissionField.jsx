import { Icon } from '../brand/Icon.jsx'

export const MISSION_EXAMPLES = ['Find the returns policy', 'Add a blue shirt in size M to the basket', 'Book a table for two on Friday', 'Find how to contact support']

// The mission for a Manual run: one thing to try to do, and whether to do
// it once as yourself first, for the comparison on the report.
export function MissionField({ value, onChange, idPrefix = 'mission' }) {
  const set = (patch) => onChange({ ...value, ...patch })
  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ember-50 text-ember-700"><Icon name="target" /></span>
        <div className="min-w-0 flex-1">
          <label htmlFor={`${idPrefix}-goal`} className="block font-semibold text-ink-900">Give yourself a mission</label>
          <p className="text-sm text-ink-600">One thing to try to do on the page. The report times it, and shows whether it was done or given up.</p>
          <input
            id={`${idPrefix}-goal`}
            type="text"
            maxLength={200}
            value={value.goal}
            onChange={(e) => set({ goal: e.target.value })}
            placeholder={`For example: ${MISSION_EXAMPLES[0]}`}
            className="mt-3 w-full rounded-xl border border-black/15 bg-white px-3.5 py-2.5 text-sm"
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MISSION_EXAMPLES.map((ex) => (
              <button key={ex} type="button" onClick={() => set({ goal: ex })}
                className="rounded-[3px] border border-rule px-2 py-0.5 text-xs text-ink-600 hover:border-ink-400 hover:text-ink-900">
                {ex}
              </button>
            ))}
          </div>
          <label className={`mt-4 flex items-start gap-3 text-sm ${value.goal.trim() ? 'text-ink-900' : 'text-ink-500'}`}>
            <input
              type="checkbox"
              className="mt-0.5 h-5 w-5"
              checked={value.firstAsMyself}
              disabled={!value.goal.trim()}
              onChange={(e) => set({ firstAsMyself: e.target.checked })}
            />
            <span>
              <span className="font-medium">Do it once as myself first</span>
              <span className="block text-ink-600">Then again as the person. The report puts the two side by side.</span>
            </span>
          </label>
        </div>
      </div>
    </div>
  )
}
