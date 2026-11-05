// What each automatic detector in the extension (extension/content-scripts/
// friction.js and the profiles that call it) is called on the report, and
// what it means for the person. Plain words, no guideline numbers.
export const FRICTION_KINDS = {
  'tremor-missed': { group: 'tremor', title: 'Clicks that missed', why: 'Targets too small or too close together for a hand that shakes.' },
  'tremor-wrong-target': { group: 'tremor', title: 'Clicks that missed', why: 'Targets too small or too close together for a hand that shakes.' },
  'keyboard-mouse-only': { group: 'mouse-only', title: 'Only usable with a mouse', why: 'They react to clicks, but the keyboard can never reach them.' },
  'keyboard-focus-lost': { group: 'focus-lost', title: 'Lost place on the page', why: 'After a press of Tab, nothing visible had focus.' },
  'keyboard-focus-hidden': { group: 'focus-hidden', title: 'Tab stops you cannot see', why: 'Hidden, off-screen or covered places still take a stop in the Tab order.' },
  'keyboard-no-focus-ring': { group: 'focus-ring', title: 'No visible focus', why: 'Focus moved, but nothing on screen showed where.' },
  'keyboard-hover-menu': { group: 'hover-menu', title: 'Menus that need a mouse', why: 'They open only under a mouse pointer, so their links never appear for the keyboard.' },
  'keyboard-tab-order': { group: 'tab-order', title: 'Tab order that jumps around', why: 'Focus does not follow the page, so it is easy to get lost.' },
  'keyboard-no-skip': { group: 'long-way', title: 'A long way by keyboard', why: 'Dozens of key presses before anything could be done.' },
  'keyboard-dead-key': { group: 'dead-key', title: 'Enter that does nothing', why: 'Things that act like buttons but only answer a mouse click.' },
  'keyboard-focus-covered': { group: 'focus-hidden', title: 'Tab stops you cannot see', why: 'Hidden, off-screen or covered places still take a stop in the Tab order.' },
  'keyboard-trap': { group: 'trap', title: 'Stuck with the keyboard', why: 'Tab kept going round the same few places.' },
  'keyboard-long-way': { group: 'long-way', title: 'A long way by keyboard', why: 'Dozens of key presses before anything could be done.' },
  'switch-long-wait': { group: 'switch-wait', title: 'Long waits with one switch', why: 'Every link on the way costs another wait for the highlight.' },
  'sr-unnamed-controls': { group: 'unnamed', title: 'Buttons and links with no name', why: 'A screen reader says only "button" or "link".' },
  'sr-unnamed-focus': { group: 'unnamed', title: 'Buttons and links with no name', why: 'A screen reader says only "button" or "link".' },
  'sr-unnamed-images': { group: 'images', title: 'Pictures with no description', why: 'What they show is lost to someone who cannot see them.' },
  'sr-no-title': { group: 'structure', title: 'Missing page structure', why: 'No title or headings to find the way by.' },
  'sr-no-headings': { group: 'structure', title: 'Missing page structure', why: 'No title or headings to find the way by.' },
  'deaf-no-captions': { group: 'captions', title: 'Video without captions', why: 'Everything said in it is lost.' },
  'deaf-video-embed': { group: 'captions', title: 'Video without captions', why: 'Captions that must be found and switched on are often never found.' }
}

const FALLBACK = { title: 'Other struggles', why: '' }

// Automatic moments grouped by what went wrong, most frequent first.
export function groupFriction(moments) {
  const groups = new Map()
  for (const m of moments) {
    const kind = FRICTION_KINDS[m.detector] || FALLBACK
    const key = kind.group || m.detector || 'other'
    if (!groups.has(key)) groups.set(key, { key, title: kind.title, why: kind.why, moments: [] })
    groups.get(key).moments.push(m)
  }
  return [...groups.values()].sort((a, b) => b.moments.length - a.moments.length)
}
