// A small set of line icons (24px grid, 1.75 stroke), so the app needs no
// icon font and every icon matches.
const PATHS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  play: 'M7 4.5v15l12-7.5z',
  people: 'M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7M20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 3.65a3.5 3.5 0 0 1 0 6.7',
  team: 'M4 21V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v16M9 21v-4h6v4M8 7h2M14 7h2M8 11h2M14 11h2',
  plus: 'M12 5v14M5 12h14',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6',
  hand: 'M7 11V5.5a1.5 1.5 0 0 1 3 0V11M10 10V4a1.5 1.5 0 0 1 3 0v6M13 10V5a1.5 1.5 0 0 1 3 0v7M16 9.5a1.5 1.5 0 0 1 3 0V14a7 7 0 0 1-7 7h-.5a7 7 0 0 1-5.9-3.2L3.3 14a1.5 1.5 0 0 1 2.5-1.7L7 14',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
  spark: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  arrow: 'M5 12h14M13 6l6 6-6 6',
  check: 'M5 12.5 10 17l9-10',
  x: 'M6 6l12 12M18 6 6 18',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 12h.01',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13',
  download: 'M4 17v2a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-2M7 11l5 5 5-5M12 4v12',
  ear: 'M6 8.5a6 6 0 0 1 12 0c0 3.5-3 4.5-3 7.5a3 3 0 0 1-6 0M9.5 9a2.5 2.5 0 0 1 5 0',
  brain: 'M9 4a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 3h0V4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 3V4z',
  keyboard: 'M3 7h18v10H3zM7 11h.01M11 11h.01M15 11h.01M7 14h10'
}

export function Icon({ name, size = 20, className = '', strokeWidth = 1.75 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={PATHS[name] || PATHS.spark} />
    </svg>
  )
}
