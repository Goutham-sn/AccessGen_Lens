import { mediaUrl } from '../../services/api.js'

function fmtMs(ms) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function EmpathySidebar({ empathyMoments, onJump, currentTime, sessionMsToVideoSeconds }) {
  return (
    <section aria-labelledby="empathy-sidebar-heading">
      <h2 id="empathy-sidebar-heading" className="text-sm font-semibold text-ink-900 mb-3">
        Moments of struggle ({empathyMoments.length})
      </h2>
      {empathyMoments.length === 0 ? (
        <p className="text-sm text-ink-500">
          No moments were flagged during this session.
        </p>
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
                    className="mb-2 h-24 w-full rounded-lg object-cover"
                    loading="lazy"
                  />
                )}
                <p className="text-xs text-ink-500 tabular-nums">{fmtMs(m.timestamp_ms)}</p>
                <p className="text-sm font-medium text-ink-900 mt-0.5">"{m.label}"</p>
                {m.note && <p className="text-sm text-ink-600 mt-1 italic">{m.note}</p>}
              </>
            )
            // Logged before recording started: no video position to jump to.
            if (sec == null) {
              return (
                <li key={m.id} className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3">
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
                    ${active ? 'border-rose-400 bg-rose-50' : 'border-gray-200 bg-white hover:border-rose-300'}`}
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
