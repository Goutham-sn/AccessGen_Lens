// Shown wherever a moment from an unverified check appears: the moment card,
// the playback list, the run page, the report. Unverified checks are built
// but not yet checked by hand; they only run in the dev-only unverified mode
// (see backend/src/config/runnerCapabilities.js). A test keeps this text the
// same as the backend's UNVERIFIED_LABEL, which the PDF uses.
export const UNVERIFIED_LABEL = 'Unverified, for testing'

export function UnverifiedLabel({ className = '' }) {
  return (
    <span className={`inline-block rounded border border-amber-600 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 ${className}`}>
      {UNVERIFIED_LABEL}
    </span>
  )
}
