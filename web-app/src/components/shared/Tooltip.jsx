import { useId, useState } from 'react'

// WCAG 1.4.13-friendly tooltip: shows on hover AND focus, dismissible with
// Escape, content persistent while hovered.
export function Tooltip({ label, children }) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
    >
      <span aria-describedby={open ? id : undefined} className="inline-flex">
        {children}
      </span>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-40 w-max max-w-xs
            rounded-md bg-ink-900 px-3 py-1.5 text-xs text-white shadow-lg"
        >
          {label}
        </span>
      )}
    </span>
  )
}
