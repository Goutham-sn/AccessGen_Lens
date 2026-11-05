// The mark: two lenses, yours and theirs, overlapping. Flat, two colours.
export function LogoMark({ size = 26, className = '', dark = false }) {
  const ink = dark ? '#fbfaf7' : '#161616'
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" aria-hidden="true" className={className}>
      <circle cx="9.5" cy="13" r="6.5" fill="none" stroke={ink} strokeWidth="2" />
      <circle cx="16.5" cy="13" r="6.5" fill="#e2502f" />
      <path d="M13 7.6a6.5 6.5 0 0 1 0 10.8a6.5 6.5 0 0 1 0-10.8z" fill={ink} />
    </svg>
  )
}

export function Logo({ dark = false, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark dark={dark} />
      <span className={`text-[15px] font-semibold tracking-tight ${dark ? 'text-paper' : 'text-ink-900'}`}>
        AccessGen Lens
      </span>
    </span>
  )
}
