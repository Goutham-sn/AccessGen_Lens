// What a run looked at and what it could not look at, shown above the
// moments so nobody reads an empty list as "nothing to see". Data comes
// from the backend (lookedAt in backend/src/utils/lookedAt.js); nothing here
// is decided in the browser. Renders nothing for sessions the runner did
// not make.
export function LookedAt({ lookedAt, headingLevel = 2, idPrefix = 'looked-at' }) {
  if (!lookedAt) return null
  const H = `h${headingLevel}`
  const Sub = `h${headingLevel + 1}`
  const size = headingLevel === 2 ? 'text-xl' : 'text-base'
  return (
    <section aria-labelledby={`${idPrefix}-heading`} className="rounded-2xl border border-gray-200 bg-white p-6">
      <H id={`${idPrefix}-heading`} className={`${size} font-semibold text-ink-900`}>What we looked at</H>
      {lookedAt.items.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-700">
          {lookedAt.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-ink-700">{lookedAt.noItems}</p>
      )}
      {lookedAt.gaps.length > 0 && (
        <>
          <Sub className="mt-5 text-sm font-semibold text-ink-900">What we could not look at</Sub>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-700">
            {lookedAt.gaps.map((gap) => <li key={gap}>{gap}</li>)}
          </ul>
        </>
      )}
    </section>
  )
}
