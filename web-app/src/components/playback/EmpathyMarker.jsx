import { Tooltip } from '../shared/Tooltip.jsx'

export function EmpathyMarker({ moment, positionPercent, onJump, current = false }) {
  return (
    <Tooltip label={moment.label}>
      <button
        type="button"
        onClick={() => onJump(moment)}
        aria-label={`Jump to empathy moment: ${moment.label}`}
        className={`absolute -translate-x-1/2 -top-1.5 h-6 w-6 rounded-full border-2 border-white shadow
          flex items-center justify-center text-[10px] text-white transition-transform hover:scale-110
          ${current ? 'bg-rose-700 scale-110' : 'bg-rose-500'}`}
        style={{ left: `${positionPercent}%` }}
      >
        ◉
      </button>
    </Tooltip>
  )
}
