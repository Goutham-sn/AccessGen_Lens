import { mediaUrl } from '../../services/api.js'
import { pinOf } from '../../utils/pins.js'
export { pinOf }

// A moment's picture with the exact places it happened ringed. Pictures are
// the visible part of the tab, so rects in viewport pixels (with the
// viewport size they were measured in) map onto it as percentages. With
// several rects (every element of one issue), each ring carries the number
// it has in the list beside it.
export function PinnedShot({ src, rect, rects = null, alt, className = '', tone = 'ember' }) {
  if (!src) return null
  const list = (rects || (rect ? [rect] : [])).map((r, i) => ({ pin: pinOf(r), n: r?.n ?? i + 1 })).filter((p) => p.pin)
  const many = list.length > 1
  return (
    <div className={`relative overflow-hidden bg-paper ${className}`}>
      <img src={mediaUrl(src)} alt={alt} className="block w-full" loading="lazy" />
      {list.map(({ pin, n }) => (
        <span
          key={n}
          aria-hidden="true"
          className={`absolute rounded-[3px] ring-2 ${tone === 'ember' ? 'ring-ember-600' : 'ring-ink-900'} shadow-[0_0_0_3px_rgba(255,255,255,.85)]`}
          style={{ left: `${pin.left}%`, top: `${pin.top}%`, width: `${pin.width}%`, height: `${pin.height}%` }}
        >
          {many && (
            <span className="absolute -left-2 -top-2.5 min-w-[16px] rounded-[2px] bg-ember-600 px-1 text-center font-mono text-[9px] font-semibold leading-[15px] text-white">{n}</span>
          )}
        </span>
      ))}
    </div>
  )
}
