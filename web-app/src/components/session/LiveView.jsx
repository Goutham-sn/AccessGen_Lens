import { getProfile, SEVERITY_LABELS } from '../../data/profiles.js'
import { Badge } from '../shared/Badge.jsx'

// Companion panel to the live simulation: active profiles + focus path.
// The actual simulated page lives in the user's other tab.
export function LiveView({ session, focusPath }) {
  const profiles = session?.active_profiles || []
  const keyboardActive = profiles.some((p) => p.id === 'keyboard-only' || p.id === 'switch-access')

  return (
    <div className="space-y-4">
      <section aria-labelledby="live-profiles-heading" className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 id="live-profiles-heading" className="text-sm font-semibold text-ink-900 mb-2">
          Living with, right now
        </h2>
        <ul className="flex flex-wrap gap-2">
          {profiles.map((ap) => {
            const p = getProfile(ap.id)
            return (
              <li key={ap.id}>
                <Badge>
                  {p?.name || ap.name || ap.id}
                  {p?.hasSeverity && ap.severity ? ` · ${SEVERITY_LABELS[ap.severity]}` : ''}
                </Badge>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-sm text-ink-600">
          The simulation is running on <strong className="break-all">{session?.url}</strong> in your
          other browser tab. Everything you do there is being recorded.
        </p>
      </section>

      {keyboardActive && (
        <section aria-labelledby="focus-path-heading" className="rounded-xl border border-gray-200 bg-white p-4">
          <h2 id="focus-path-heading" className="text-sm font-semibold text-ink-900 mb-2">
            Focus path
          </h2>
          {focusPath.length === 0 ? (
            <p className="text-sm text-ink-500">Press Tab on the simulated page to begin moving.</p>
          ) : (
            <ol className="space-y-1 max-h-48 overflow-y-auto text-sm text-ink-700">
              {focusPath.slice(-30).map((f, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-ink-500 tabular-nums shrink-0 w-8">
                    {f.tabIndex ?? focusPath.length - 30 + i + 1}.
                  </span>
                  <span className="truncate">{f.element?.label || f.element?.tag || 'element'}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}
    </div>
  )
}
