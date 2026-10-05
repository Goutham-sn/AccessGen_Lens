// "For your team": the only place guideline names and numbers appear.
// They are context for the people who will make changes, never a verdict.
export function ForYourTeam({ id, guidelines, hidden }) {
  if (!guidelines?.length) return null
  return (
    <div id={id} hidden={hidden} className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <h5 className="text-sm font-semibold text-ink-900">For your team</h5>
      <p className="mt-1 text-sm text-ink-700">Guidelines this relates to</p>
      <ul className="mt-2 space-y-1 text-sm text-ink-900">
        {guidelines.map((g) => (
          <li key={g.number}>
            {g.name} ({g.number}, level {g.level})
          </li>
        ))}
      </ul>
    </div>
  )
}
