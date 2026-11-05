import { UnverifiedLabel } from '../shared/UnverifiedLabel.jsx'

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
    <section aria-labelledby={`${idPrefix}-heading`} className="card p-6">
      <H id={`${idPrefix}-heading`} className={`${size} font-semibold text-ink-900`}>What we looked at</H>
      {lookedAt.items.length > 0 ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-700">
          {lookedAt.items.map((item) => <li key={item}>{item}</li>)}
        </ul>
      ) : (
        <p className="mt-3 text-ink-700">{lookedAt.noItems}</p>
      )}
      {lookedAt.unverified && (
        <div className="mt-4">
          <UnverifiedLabel />
          <p className="mt-2 text-sm text-ink-700">
            {lookedAt.unverified.moments} {lookedAt.unverified.moments === 1 ? 'moment' : 'moments'} from these checks.
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-ink-700">
            {lookedAt.unverified.items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
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
