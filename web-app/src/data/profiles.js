export const PROFILE_CATEGORIES = {
  VISUAL: 'Visual',
  MOTOR: 'Motor',
  COGNITIVE: 'Cognitive',
  HEARING: 'Hearing',
  SCREEN_READER: 'Screen Reader'
}

export const SEVERITY_LABELS = { 1: 'Mild', 2: 'Moderate', 3: 'Severe' }

export const PROFILES = [
  {
    id: 'deuteranopia',
    name: 'Deuteranopia',
    category: PROFILE_CATEGORIES.VISUAL,
    tagline: 'Red-green colorblindness. Affects 6% of men.',
    description: 'Red and green appear as the same muddy yellow-brown. Charts, error messages, and status indicators that rely on color alone become indistinguishable.',
    hasSeverity: false,
    icon: 'eye'
  },
  {
    id: 'achromatopsia',
    name: 'Achromatopsia',
    category: PROFILE_CATEGORIES.VISUAL,
    tagline: 'Complete color blindness. The world in greyscale.',
    description: 'No color perception at all. Every element appears in shades of grey. If your UI uses color alone to convey meaning, it becomes unusable.',
    hasSeverity: false,
    icon: 'eye-off'
  },
  {
    id: 'low-vision',
    name: 'Low Vision',
    category: PROFILE_CATEGORIES.VISUAL,
    tagline: 'Severe visual impairment. Not correctable by glasses.',
    description: 'Everything is blurred and dimmed. Small text becomes completely unreadable. Only large, high-contrast elements survive.',
    hasSeverity: true,
    icon: 'eye'
  },
  {
    id: 'tunnel-vision',
    name: 'Tunnel Vision',
    category: PROFILE_CATEGORIES.VISUAL,
    tagline: 'Peripheral vision lost. Common in Glaucoma.',
    description: 'Only a small circle of vision remains. Navigation menus, sidebars, and anything at the edges of the screen vanishes entirely.',
    hasSeverity: true,
    icon: 'focus'
  },
  {
    id: 'macular-degeneration',
    name: 'Macular Degeneration',
    category: PROFILE_CATEGORIES.VISUAL,
    tagline: 'Central vision lost. Reading becomes impossible.',
    description: 'A dark blotch obscures exactly where you look. Reading text requires looking slightly beside it. The most common cause of vision loss in people over 50.',
    hasSeverity: true,
    icon: 'eye'
  },
  {
    id: 'keyboard-only',
    name: 'Keyboard Only',
    category: PROFILE_CATEGORIES.MOTOR,
    tagline: 'Mouse is completely unavailable.',
    description: 'Every interaction must happen via keyboard. Tab, Shift+Tab, Enter, Space, Arrow Keys. Mouse clicks do nothing at all.',
    hasSeverity: false,
    icon: 'keyboard'
  },
  {
    id: 'tremor',
    name: 'Tremor',
    category: PROFILE_CATEGORIES.MOTOR,
    tagline: "Uncontrollable hand shaking. Common in Parkinson's.",
    description: 'The cursor shakes continuously and unpredictably. Small click targets become nearly impossible to hit. Anything under 44px is genuinely inaccessible.',
    hasSeverity: true,
    icon: 'hand-stop'
  },
  {
    id: 'switch-access',
    name: 'Switch Access',
    category: PROFILE_CATEGORIES.MOTOR,
    tagline: "One switch. That's all. Used in ALS and quadriplegia.",
    description: 'The screen scans through every element one by one. Only one key activates the current element. Every page load starts from the very top.',
    hasSeverity: true,
    icon: 'toggle-right'
  },
  {
    id: 'dyslexia',
    name: 'Dyslexia',
    category: PROFILE_CATEGORIES.COGNITIVE,
    tagline: 'Reading difficulty affecting 15-20% of people.',
    description: 'Dense paragraphs, justified text, and small fonts become exhausting to read. A reading guide helps but slow rendering and complex layouts cause genuine struggle.',
    hasSeverity: true,
    icon: 'text-size'
  },
  {
    id: 'adhd',
    name: 'ADHD',
    category: PROFILE_CATEGORIES.COGNITIVE,
    tagline: 'Attention and focus challenges.',
    description: 'Peripheral animations, auto-playing content, and cluttered layouts make it nearly impossible to stay on task. Distraction is constant and involuntary.',
    hasSeverity: true,
    icon: 'brain'
  },
  {
    id: 'deaf',
    name: 'Deaf / Hard of Hearing',
    category: PROFILE_CATEGORIES.HEARING,
    tagline: 'All audio unavailable.',
    description: 'Every video, audio clip, and sound-based notification is silenced. Videos without captions become completely inaccessible. Audio-only content is entirely lost.',
    hasSeverity: false,
    icon: 'volume-off'
  },
  {
    id: 'screen-reader',
    name: 'Screen Reader',
    category: PROFILE_CATEGORIES.SCREEN_READER,
    tagline: 'Navigate entirely by listening. No visual reference.',
    description: 'The page is navigated purely by hearing announcements of each element. Visual layout is irrelevant. Logical reading order, labels, and roles are everything.',
    hasSeverity: false,
    icon: 'volume'
  }
]

export function getProfile(id) {
  return PROFILES.find((p) => p.id === id)
}

// Natural-language description of a profile combination, e.g.
// "You will navigate as someone with severe tunnel vision and hand tremor, using only keyboard controls."
export function describeCombination(activeProfiles) {
  if (!activeProfiles || activeProfiles.length === 0) {
    return 'Select at least one profile to begin. Each one changes how the page looks, sounds, or responds.'
  }
  const parts = []
  let keyboardOnly = false
  let screenReader = false

  for (const ap of activeProfiles) {
    const p = getProfile(ap.id)
    if (!p) continue
    if (ap.id === 'keyboard-only') { keyboardOnly = true; continue }
    if (ap.id === 'screen-reader') { screenReader = true; continue }
    const sev = p.hasSeverity ? `${SEVERITY_LABELS[ap.severity || 2].toLowerCase()} ` : ''
    parts.push(`${sev}${p.name.toLowerCase()}`)
  }

  let sentence = 'You will navigate as someone'
  if (parts.length > 0) {
    const list = parts.length > 1
      ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`
      : parts[0]
    sentence += ` with ${list}`
  }
  if (screenReader) sentence += `${parts.length ? ',' : ''} relying on a screen reader to hear the page`
  if (keyboardOnly) sentence += `, using only keyboard controls`
  return sentence + '.'
}
