import { mediaUrl } from '../../services/api.js'
import { UnverifiedLabel } from '../shared/UnverifiedLabel.jsx'
import { isAutoMoment, momentTitle } from '../../utils/moments.js'

function fmtMs(ms) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

// emptyText comes from the backend (noMomentsText); never an all-clear.
export function EmpathySidebar({ empathyMoments, onJump, currentTime, sessionMsToVideoSeconds, emptyText }) {
  return (
    <section aria-labelledby="empathy-sidebar-heading">
      <h2 id="empathy-sidebar-heading" className="text-sm font-semibold text-ink-900 mb-3">
        Moments of struggle ({empathyMoments.length})
      </h2>
      {empathyMoments.some(isAutoMoment) && (
        <p className="text-xs text-ink-600 -mt-2 mb-3">
          <span className="inline-block h-2 w-2 rounded-full bg-ember-500 mr-1" aria-hidden="true" />You logged it
          <span className="inline-block h-2 w-2 rounded-full bg-ink-900 ml-3 mr-1" aria-hidden="true" />The simulation noticed it
        </p>
      )}
      {empathyMoments.length === 0 ? (
        emptyText ? <p className="text-sm text-ink-500">{emptyText}</p> : null
      ) : (
        <ul className="space-y-3">
          {empathyMoments.map((m) => {
            const sec = sessionMsToVideoSeconds(m.timestamp_ms)
            const content = (
              <>
                {m.screenshot_url && (
                  <img
                    src={mediaUrl(m.screenshot_url)}
                    alt=""
                    className="mb-2 h-28 w-full rounded-lg object-cover object-top bg-paper"
                    loading="lazy"
                  />
                )}
                <p className="text-xs text-ink-500 tabular-nums">
                  {fmtMs(m.timestamp_ms)}
                  {isAutoMoment(m) && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 font-medium">Noticed automatically</span>}
                </p>
                {m.unverified && <p className="mt-1"><UnverifiedLabel /></p>}
                <p className="text-sm font-medium text-ink-900 mt-0.5">{momentTitle(m)}</p>
                {m.note && <p className={`text-sm text-ink-600 mt-1 ${isAutoMoment(m) ? '' : 'italic'}`}>{m.note}</p>}
              </>
            )
            // Logged before recording started: no video position to jump to.
            if (sec == null) {
              return (
                <li key={m.id} className="rounded-xl border border-dashed border-rule bg-paper p-3">
                  {content}
                  <p className="text-xs text-ink-600 mt-1">Logged before recording started, no video position.</p>
                </li>
              )
            }
            const active = Math.abs(currentTime - sec) < 1.5
            return (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onJump(sec)}
                  className={`w-full text-left rounded-xl border p-3 transition-colors
                    ${active ? (isAutoMoment(m) ? 'border-amber-400 bg-amber-50' : 'border-ember-400 bg-ember-50') : 'border-rule bg-white hover:border-ember-300'}`}
                >
                  {content}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
