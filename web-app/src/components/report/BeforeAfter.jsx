import { useCallback, useEffect, useRef, useState } from 'react'

// Drag-slider comparison of the page under normal conditions vs. under
// the simulation. Keyboard operable: the divider is a slider (arrow keys).
export function BeforeAfter({ normalImageUrl, simulatedImageUrl }) {
  const [position, setPosition] = useState(50)
  const containerRef = useRef(null)
  const dragging = useRef(false)

  const updateFromClientX = useCallback((clientX) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return
    const pct = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.max(0, Math.min(100, pct)))
  }, [])

  useEffect(() => {
    function onMove(e) {
      if (!dragging.current) return
      updateFromClientX(e.touches ? e.touches[0].clientX : e.clientX)
    }
    function onUp() { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('touchmove', onMove)
    window.addEventListener('touchend', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onUp)
    }
  }, [updateFromClientX])

  function onKeyDown(e) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); setPosition((p) => Math.max(0, p - 5)) }
    if (e.key === 'ArrowRight') { e.preventDefault(); setPosition((p) => Math.min(100, p + 5)) }
    if (e.key === 'Home') { e.preventDefault(); setPosition(0) }
    if (e.key === 'End') { e.preventDefault(); setPosition(100) }
  }

  if (!simulatedImageUrl) return null

  return (
    <section aria-labelledby="before-after-heading" className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 id="before-after-heading" className="text-xl font-semibold text-ink-900 mb-1">
        Two people, one page
      </h2>
      <p className="text-sm text-ink-600 mb-4">
        Drag the divider (or focus it and use arrow keys) to compare what most people see
        with what this visitor saw.
      </p>

      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-xl select-none"
        onMouseDown={(e) => { dragging.current = true; updateFromClientX(e.clientX) }}
        onTouchStart={(e) => { dragging.current = true; updateFromClientX(e.touches[0].clientX) }}
      >
        {normalImageUrl ? (
          <img src={normalImageUrl} alt="The page under normal vision" className="w-full block" draggable="false" />
        ) : (
          <div className="w-full aspect-video bg-gray-100 flex items-center justify-center text-sm text-ink-500">
            Normal view not captured
          </div>
        )}

        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
          aria-hidden="true"
        >
          <img src={simulatedImageUrl} alt="" className="w-full h-full object-cover block" draggable="false" />
        </div>

        <div
          role="slider"
          tabIndex={0}
          aria-label="Comparison divider"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(position)}
          aria-valuetext={`Simulated view covers ${Math.round(position)}% of the image`}
          onKeyDown={onKeyDown}
          className="absolute top-0 bottom-0 w-1 bg-white cursor-ew-resize shadow-[0_0_4px_rgba(0,0,0,0.5)]"
          style={{ left: `${position}%` }}
        >
          <span
            aria-hidden="true"
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 left-1/2 flex h-9 w-9
              items-center justify-center rounded-full bg-white shadow-lg text-ink-700 font-bold"
          >
            ↔
          </span>
        </div>

        <span className="absolute top-3 left-3 rounded bg-black/60 px-2 py-1 text-xs text-white">Simulated</span>
        <span className="absolute top-3 right-3 rounded bg-black/60 px-2 py-1 text-xs text-white">Normal</span>
      </div>
    </section>
  )
}
