import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// Accessible modal: focus trap, Escape to close, focus restoration,
// aria-modal + labelled title.
export function Modal({ open, onClose, title, children, wide = false }) {
  const panelRef = useRef(null)
  const previouslyFocused = useRef(null)
  // Read the latest onClose from a ref so the setup effect below doesn't
  // need it as a dependency: onClose is often an inline arrow function
  // that gets a new identity on every parent render (e.g. while the user
  // types into a field inside the modal), which would otherwise re-run
  // the effect and steal focus back to the first focusable element.
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) return
    previouslyFocused.current = document.activeElement

    const panel = panelRef.current
    const focusables = () => panel.querySelectorAll(
      'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    // Focus first focusable element (or the panel itself)
    const first = focusables()[0]
    ;(first || panel).focus()

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onCloseRef.current()
      }
      if (e.key === 'Tab') {
        const items = Array.from(focusables())
        if (items.length === 0) return
        const firstEl = items[0]
        const lastEl = items[items.length - 1]
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault(); lastEl.focus()
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault(); firstEl.focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      previouslyFocused.current?.focus?.()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink-900/60" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`relative bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-3xl' : 'max-w-md'}
          max-h-[90vh] overflow-y-auto p-6`}
      >
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-2 text-ink-600 hover:bg-paper hover:text-ink-900"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}
