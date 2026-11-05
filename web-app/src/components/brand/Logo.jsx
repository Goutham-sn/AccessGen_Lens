// The mark: two lenses overlapping. Your view, and theirs, and the place
// where they meet.
export function LogoMark({ size = 28, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="lens-a" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8c7fff" />
          <stop offset="1" stopColor="#4b36cc" />
        </linearGradient>
        <linearGradient id="lens-b" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffad93" />
          <stop offset="1" stopColor="#ff6a45" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="#13141c" />
      <circle cx="12.5" cy="16" r="7" fill="url(#lens-a)" />
      <circle cx="19.5" cy="16" r="7" fill="url(#lens-b)" style={{ mixBlendMode: 'screen' }} opacity="0.92" />
      <circle cx="16" cy="16" r="1.6" fill="#13141c" />
    </svg>
  )
}

export function Logo({ dark = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className={`font-semibold tracking-tight ${dark ? 'text-white' : 'text-ink-900'}`}>
        AccessGen <span className={dark ? 'text-brand-300' : 'text-brand-700'}>Lens</span>
      </span>
    </span>
  )
}
