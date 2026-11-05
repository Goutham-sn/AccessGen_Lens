import { mediaUrl } from '../../services/api.js'
import { pinOf } from '../../utils/pins.js'
export { pinOf }

// A moment's picture with the exact place it happened ringed. Pictures are
// the visible part of the tab, so a rect in viewport pixels (with the
// viewport size it was measured in) maps onto it as percentages (pins.js).
export function PinnedShot({ src, rect, alt, className = '', tone = 'ember' }) {
  const pin = pinOf(rect)
  if (!src) return null
  return (
    <div className={`relative overflow-hidden bg-stone-100 ${className}`}>
      <img src={mediaUrl(src)} alt={alt} className="block w-full" loading="lazy" />
      {pin && (
        <span
          aria-hidden="true"
          className={`absolute rounded-lg ring-[3px] ${tone === 'ember' ? 'ring-ember-500 shadow-[0_0_0_6px_rgba(255,106,69,.25),0_0_30px_rgba(255,106,69,.55)]' : 'ring-amber-500'}`}
          style={{ left: `${pin.left}%`, top: `${pin.top}%`, width: `${pin.width}%`, height: `${pin.height}%` }}
        />
      )}
    </div>
  )
}
