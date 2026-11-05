import { Tooltip } from '../shared/Tooltip.jsx'
import { isAutoMoment } from '../../utils/moments.js'

// The positioned wrapper is outside the Tooltip: the Tooltip's own span is
// `relative`, so a left % set inside it was measured against that zero-width
// span and every marker sat at 0:00.
export function EmpathyMarker({ moment, positionPercent, onJump, current = false }) {
  const auto = isAutoMoment(moment)
  return (
    <div className="absolute -top-1.5 -translate-x-1/2" style={{ left: `${Math.max(0, Math.min(100, positionPercent))}%` }}>
      <Tooltip label={auto ? `Noticed: ${moment.label}` : moment.label}>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onJump(moment) }}
          aria-label={`Jump to ${auto ? 'noticed struggle' : 'empathy moment'}: ${moment.label}`}
          className={`h-6 w-6 rounded-full border-2 border-white shadow
            flex items-center justify-center text-[10px] text-white transition-transform hover:scale-110
            ${auto ? (current ? 'bg-amber-700 scale-110' : 'bg-amber-500') : (current ? 'bg-rose-700 scale-110' : 'bg-rose-500')}`}
        >
          <span aria-hidden="true">{auto ? '!' : '◉'}</span>
        </button>
      </Tooltip>
    </div>
  )
}
