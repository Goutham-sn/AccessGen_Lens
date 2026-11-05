// Cards on the /start page. Copy only: what the runner can actually do comes
// from GET /api/runs/capabilities (backend/src/config/runnerCapabilities.js),
// so a card never claims a check that is not running.
//
// mode:         'automated' (Watch it happen), 'extension' (Explore it myself),
//               'later' (Others and coming soon)
// kind:         'person' or 'situation'
// draft:        true until the copy has been reviewed. Shown as a "Draft" tag
//               in development builds only.
// personaName:  links the card to a built-in persona (names are unique)
// avatarColor:  the tint of the person's initial wherever it is shown (the
//               Personas page, Configure, report covers, the landing page).
//               Every card of one person has the same colour.
// profiles:     exactly what this card runs (automated) or applies (extension)
// looksAt:      { text, check }. Automated items show only when their check is
//               live; the rest move to "Not looked at in this run".
// notSimulated: { text, profile?, seeCard? }. seeCard links to the card on
//               this page that covers that profile.
// guidelines:   shown only inside "For your team".
//
// Copy rules: third person, no verdict words, no guideline names or numbers
// outside `guidelines`. No bare pronouns: use the tokens {they} (only before
// "can"), {them}, {their} and {Their}, filled from the persona's pronouns
// (fillPronouns below), which default to they/them/their.

const ONLY_OBSERVES = {
  text: 'Pressing Enter or Space, typing, signing in or submitting anything. This run only watches.'
}

export const PERSONA_CARDS = [
  // ------------------------------------------------------------ automated
  {
    id: 'david-keyboard-colour',
    mode: 'automated',
    kind: 'person',
    draft: true,
    personaName: 'David',
    name: 'David',
    age: 38,
    place: 'London, UK',
    avatarColor: '#B7C9E8',
    experience: 'keyboard and colour',
    story: 'Software architect, born with deuteranopia. A fast keyboard user who rarely reaches for the mouse, and who has learned to work around sites that use colour alone.',
    howTheyUseTheWeb: 'David moves through every page with Tab and Shift+Tab. Reds and greens look like the same muddy brown to {them}.',
    whatYouWillSee: [
      'The page in the colours David sees',
      'Each place focus lands, one press of Tab at a time',
      'A counter in the corner for every key David presses'
    ],
    looksAt: [
      { text: 'Where each press of Tab lands, and how many presses it takes', check: 'tab-walk' },
      { text: 'The page in the colours David sees', check: 'filter-video' },
      { text: 'Whether David can see where Tab has landed after each press', check: 'focus-visible' },
      { text: 'How many presses it takes David to reach the main content', check: 'long-way' },
      { text: "Places where David's place on the page disappears", check: 'focus-lost' },
      { text: 'Places where something covers the part of the page David is on', check: 'focus-hidden' },
      { text: 'Places where Tab keeps David going round in a loop', check: 'trap' },
      { text: 'Anything marked only by colour, and every other rule of the accessibility rules engine', check: 'page-audit' }
    ],
    notSimulated: [ONLY_OBSERVES],
    estimatedSeconds: 30,
    profiles: [{ id: 'keyboard-only', severity: 3 }, { id: 'deuteranopia', severity: 3 }],
    guidelines: [
      { name: 'Keyboard', number: '2.1.1', level: 'A' },
      { name: 'No Keyboard Trap', number: '2.1.2', level: 'A' },
      { name: 'Bypass Blocks', number: '2.4.1', level: 'A' },
      { name: 'Focus Order', number: '2.4.3', level: 'A' },
      { name: 'Focus Visible', number: '2.4.7', level: 'AA' },
      { name: 'Focus Not Obscured (Minimum)', number: '2.4.11', level: 'AA' },
      { name: 'Use of Color', number: '1.4.1', level: 'A' }
    ]
  },
  {
    id: 'james-screen-reader',
    mode: 'automated',
    kind: 'person',
    draft: true,
    personaName: 'James',
    name: 'James',
    age: 32,
    place: 'New York, USA',
    avatarColor: '#C9E8B7',
    experience: 'screen reader',
    story: 'Blind since birth. James uses the NVDA screen reader and the keyboard for everything, and moves quickly through pages that are built with care.',
    howTheyUseTheWeb: 'James listens to each page, jumping between headings, regions and links, and relies on every button and field having a name {they} can hear.',
    whatYouWillSee: [
      'Each place focus lands as James presses Tab',
      'A counter in the corner for every key James presses'
    ],
    looksAt: [
      { text: 'Where each press of Tab lands, and how many presses it takes', check: 'tab-walk' },
      { text: 'Buttons and links with no name James could hear', check: 'page-audit' },
      { text: 'Images with no description, and form fields with no label', check: 'page-audit' },
      { text: 'Whether the page has a title, a language, headings and a main area to jump to', check: 'page-audit' },
      { text: 'Every other rule of the accessibility rules engine, with each element that fails it', check: 'page-audit' }
    ],
    notSimulated: [
      { text: 'The voice and shortcut keys of a real screen reader. This run reads the page structure the browser exposes.' },
      ONLY_OBSERVES
    ],
    estimatedSeconds: 45,
    profiles: [{ id: 'screen-reader', severity: 3 }, { id: 'keyboard-only', severity: 3 }],
    guidelines: [
      { name: 'Non-text Content', number: '1.1.1', level: 'A' },
      { name: 'Info and Relationships', number: '1.3.1', level: 'A' },
      { name: 'Page Titled', number: '2.4.2', level: 'A' },
      { name: 'Headings and Labels', number: '2.4.6', level: 'AA' },
      { name: 'Language of Page', number: '3.1.1', level: 'A' },
      { name: 'Name, Role, Value', number: '4.1.2', level: 'A' }
    ]
  },
  lowVisionCard({
    id: 'meera-low-vision',
    personaName: 'Meera',
    avatarColor: '#E8D5B7',
    age: 72,
    place: 'Chennai, India',
    severity: 1,
    story: 'Retired schoolteacher who started using the internet to video call grandchildren. Age has blurred {their} sight, and Meera reads with the screen close to {their} face.',
    howTheyUseTheWeb: 'Meera makes text bigger and leans in. Thin, pale text and anything that jumps around while zooming slows {them} down.',
    notSimulated: [
      { text: '{Their} macular degeneration, which hides the centre of what Meera looks at.', profile: 'macular-degeneration' },
      { text: "{Their} hand tremor. Explore tremor yourself with Ravi's card.", profile: 'tremor', seeCard: 'ravi-tremor' }
    ]
  }),
  lowVisionCard({
    id: 'thomas-low-vision',
    personaName: 'Thomas',
    avatarColor: '#B7E8C9',
    age: 51,
    place: 'Dublin, Ireland',
    severity: 1,
    story: 'Former construction site manager. A stroke two years ago affected {their} right hand and {their} side vision, and Thomas is determined to stay independent online.',
    howTheyUseTheWeb: 'Thomas zooms in and reads slowly, and loses {their} place when parts of the page move or cover the text being read.',
    notSimulated: [
      { text: '{Their} narrowed side vision after the stroke.', profile: 'tunnel-vision' },
      { text: "{Their} hand tremor. Explore tremor yourself with Ravi's card.", profile: 'tremor', seeCard: 'ravi-tremor' }
    ]
  }),
  lowVisionCard({
    id: 'ravi-low-vision',
    personaName: 'Ravi',
    avatarColor: '#E8D4B7',
    age: 65,
    place: 'Hyderabad, India',
    severity: 2,
    story: 'Retired bank manager with Parkinson\'s. Ravi uses the computer for news, banking and staying in touch, and long sessions tire {them} quickly.',
    howTheyUseTheWeb: 'Ravi zooms in to read and takes {their} time. Pages that need many small, precise moves wear {them} out.',
    notSimulated: [
      { text: '{Their} tremor. Explore it yourself with the tremor card.', profile: 'tremor', seeCard: 'ravi-tremor' }
    ]
  }),

  // ------------------------------------------------------------ extension
  {
    id: 'ravi-tremor',
    mode: 'extension',
    kind: 'person',
    draft: true,
    personaName: 'Ravi',
    name: 'Ravi',
    age: 65,
    place: 'Hyderabad, India',
    avatarColor: '#E8D4B7',
    experience: 'tremor',
    story: "Retired bank manager with Parkinson's. Ravi's tremor has grown stronger over the last few years, and fine movements take real effort.",
    howTheyUseTheWeb: 'Ravi uses a mouse, but {their} hand shakes. Small buttons, links that sit close together and anything that needs dragging are hard to hit.',
    whatYouWillSee: [
      'Your own pointer shaking the way Ravi\'s hand does',
      'How hard it is to hit small targets that sit close together',
      'A recording of your attempt, with the moments you mark'
    ],
    looksAt: [
      { text: 'How it feels to hit small buttons and links with a shaking hand' },
      { text: 'Anything that needs dragging, swiping or a precise gesture' }
    ],
    notSimulated: [
      { text: '{Their} low vision. Watch it happen with the low vision card.', profile: 'low-vision', seeCard: 'ravi-low-vision' }
    ],
    estimatedSeconds: 180,
    profiles: [{ id: 'tremor', severity: 3 }],
    guidelines: [
      { name: 'Target Size (Minimum)', number: '2.5.8', level: 'AA' },
      { name: 'Pointer Gestures', number: '2.5.1', level: 'A' },
      { name: 'Dragging Movements', number: '2.5.7', level: 'AA' }
    ]
  },
  {
    id: 'ananya-adhd-dyslexia',
    mode: 'extension',
    kind: 'person',
    draft: true,
    personaName: 'Ananya',
    name: 'Ananya',
    age: 19,
    place: 'Bengaluru, India',
    avatarColor: '#D4B7E8',
    experience: 'ADHD and dyslexia',
    story: 'First year engineering student, bright and passionate about technology. Ananya was diagnosed with dyslexia and ADHD at twelve.',
    howTheyUseTheWeb: 'Ananya reads in short bursts. Dense text, moving content and anything that competes for {their} attention pulls {them} away from what Ananya came to do.',
    whatYouWillSee: [
      'Text that is harder to read, the way Ananya experiences it',
      'Movement and distractions that pull at your attention',
      'A recording of your attempt, with the moments you mark'
    ],
    looksAt: [
      { text: 'Content that moves, flashes or updates on its own' },
      { text: 'Anything with a time limit Ananya might not finish within' },
      { text: 'Long blocks of text without breaks' }
    ],
    notSimulated: [],
    estimatedSeconds: 180,
    profiles: [{ id: 'dyslexia', severity: 2 }, { id: 'adhd', severity: 2 }],
    guidelines: [
      { name: 'Pause, Stop, Hide', number: '2.2.2', level: 'A' },
      { name: 'Timing Adjustable', number: '2.2.1', level: 'A' }
    ]
  },
  {
    id: 'fatima-deaf',
    mode: 'extension',
    kind: 'person',
    draft: true,
    personaName: 'Fatima',
    name: 'Fatima',
    age: 29,
    place: 'Dubai, UAE',
    avatarColor: '#E8B7C9',
    experience: 'deaf',
    story: 'Deaf community advocate and content creator. Fatima relies on captions, transcripts and text for all audio and video.',
    howTheyUseTheWeb: 'Fatima watches with the sound gone. A video without captions tells {them} nothing, however good it looks.',
    whatYouWillSee: [
      'The page with all sound removed',
      'Which videos and audio still make sense without it',
      'A recording of your attempt, with the moments you mark'
    ],
    looksAt: [
      { text: 'Videos and audio, and whether captions or a transcript are there' },
      { text: 'Alerts and messages that only make a sound' }
    ],
    notSimulated: [],
    estimatedSeconds: 180,
    profiles: [{ id: 'deaf', severity: 3 }],
    guidelines: [
      { name: 'Captions (Prerecorded)', number: '1.2.2', level: 'A' }
    ]
  },

  // ---------------------------------------------------- others, coming soon
  {
    id: 'arjun-voice-control',
    mode: 'later',
    kind: 'person',
    draft: true,
    name: 'Arjun',
    age: 41,
    place: 'Mumbai, India',
    experience: 'voice control',
    story: 'Architect who lost the use of {their} hands in a spinal injury. Arjun runs {their} computer entirely by voice.',
    howTheyUseTheWeb: 'Arjun says what is on screen, such as "click Sign in". When a button\'s visible words differ from its name, {their} commands stop working.'
  },
  {
    id: 'sofia-switch-access',
    mode: 'extension',
    kind: 'person',
    draft: true,
    name: 'Sofia',
    age: 27,
    place: 'Lisbon, Portugal',
    avatarColor: '#E8C9B7',
    experience: 'switch access',
    story: 'Translator with cerebral palsy. Sofia uses a switch mounted by {their} head.',
    howTheyUseTheWeb: 'A highlight moves through the page one item at a time, and Sofia presses the switch when it reaches the thing {they} can use next. Unlike a keyboard user, Sofia cannot jump ahead, so every extra stop costs {them} time, and anything that times out or moves on its own can undo {their} progress.',
    whatYouWillSee: [
      'A highlight stepping through every link and button, one at a time',
      'Space as your only switch: the mouse and every other key are gone',
      'How long it takes to reach one thing, and the waits the simulation notices'
    ],
    looksAt: [
      { text: 'How long it takes to reach what you came for, one stop at a time' },
      { text: 'Anything that moves on, times out or changes while you wait' }
    ],
    notSimulated: [
      { text: 'A second switch, or the scanning settings a real switch user would tune for {them}self.' }
    ],
    estimatedSeconds: 180,
    profiles: [{ id: 'switch-access', severity: 2 }],
    guidelines: [
      { name: 'Keyboard', number: '2.1.1', level: 'A' },
      { name: 'Timing Adjustable', number: '2.2.1', level: 'A' },
      { name: 'Bypass Blocks', number: '2.4.1', level: 'A' }
    ]
  },
  {
    id: 'margaret-cataracts',
    mode: 'extension',
    kind: 'person',
    draft: true,
    name: 'Margaret',
    age: 78,
    place: 'Leeds, UK',
    avatarColor: '#E8E1B7',
    experience: 'cataracts and glare',
    story: 'Retired nurse waiting for cataract surgery. Everything looks hazy, and bright screens dazzle {them}.',
    howTheyUseTheWeb: 'Margaret turns the brightness down and still squints. Pale grey text on white almost disappears for {them}.',
    whatYouWillSee: [
      'The page through a clouded, yellowed lens',
      'A milky glare that washes out pale text and thin lines',
      'Which words and buttons still stand out, and which vanish'
    ],
    looksAt: [
      { text: 'Pale text, thin fonts and low-contrast buttons' },
      { text: 'Anything marked only by a soft colour difference' }
    ],
    notSimulated: [
      { text: 'How {their} eyes tire over a long session, and the dazzle of a bright room.' }
    ],
    estimatedSeconds: 180,
    profiles: [{ id: 'cataracts', severity: 2 }],
    guidelines: [
      { name: 'Contrast (Minimum)', number: '1.4.3', level: 'AA' },
      { name: 'Non-text Contrast', number: '1.4.11', level: 'AA' },
      { name: 'Resize Text', number: '1.4.4', level: 'AA' }
    ]
  },
  {
    id: 'kenji-colour',
    mode: 'extension',
    kind: 'person',
    draft: true,
    name: 'Kenji',
    age: 45,
    place: 'Osaka, Japan',
    avatarColor: '#C9B7E8',
    experience: 'protanopia',
    story: 'Logistics planner with protanopia: reds look dark and dull to {them}.',
    howTheyUseTheWeb: 'Kenji reads charts and maps all day, and misses anything that is only marked in red.',
    whatYouWillSee: [
      'The page in the colours Kenji sees',
      'Red warnings, prices and error borders that sink into the page',
      'Charts and status colours that stop telling things apart'
    ],
    looksAt: [
      { text: 'Anything that is marked only by being red or green' },
      { text: 'Charts, maps and status lights that rely on colour' }
    ],
    notSimulated: [
      { text: 'Tritanopia, where blues and yellows are hard to tell apart. Choose it yourself on the conditions page.' }
    ],
    estimatedSeconds: 180,
    profiles: [{ id: 'protanopia', severity: 3 }],
    guidelines: [
      { name: 'Use of Color', number: '1.4.1', level: 'A' },
      { name: 'Non-text Contrast', number: '1.4.11', level: 'AA' }
    ]
  },
  {
    id: 'situation-sunlight',
    mode: 'later',
    kind: 'situation',
    draft: true,
    name: 'Bright sunlight on a phone',
    story: 'Anyone outdoors on a sunny day, with the screen washed out by glare.',
    howTheyUseTheWeb: 'Faint text and light colours vanish, so only strong contrast stays readable.'
  },
  {
    id: 'situation-no-sound',
    mode: 'later',
    kind: 'situation',
    draft: true,
    name: 'A noisy place with no sound',
    story: 'Anyone on a train or in a busy cafe, with the sound off or drowned out.',
    howTheyUseTheWeb: 'Videos and alerts need captions or text to make sense.'
  },
  {
    id: 'situation-one-hand',
    mode: 'later',
    kind: 'situation',
    draft: true,
    name: 'One hand free',
    story: 'Anyone holding a child, a bag or a coffee, using a phone with one thumb.',
    howTheyUseTheWeb: 'Small or far away buttons and gestures that need two fingers get in the way.'
  },
  {
    id: 'situation-slow-connection',
    mode: 'later',
    kind: 'situation',
    draft: true,
    name: 'A slow connection or an old phone',
    story: 'Anyone on a weak signal or an older device.',
    howTheyUseTheWeb: 'Pages that load in pieces shift just as a thumb reaches a button, and heavy pages may never finish.'
  }
]

// The three low vision cards share what the runner shows and looks at.
function lowVisionCard({ id, personaName, avatarColor, age, place, severity, story, howTheyUseTheWeb, notSimulated }) {
  return {
    id,
    mode: 'automated',
    kind: 'person',
    draft: true,
    personaName,
    name: personaName,
    avatarColor,
    age,
    place,
    experience: 'low vision',
    story,
    howTheyUseTheWeb,
    whatYouWillSee: [
      'The page blurred and dimmed to {their} level of sight',
      'A slow scroll from the top of the page to the bottom'
    ],
    looksAt: [
      { text: 'The page blurred and dimmed to {their} level of sight', check: 'filter-video' },
      { text: 'Text too faint to read against its background', check: 'page-audit' },
      { text: 'Whether zoom is switched off, and every other rule of the accessibility rules engine', check: 'page-audit' }
    ],
    notSimulated: [...notSimulated, ONLY_OBSERVES],
    estimatedSeconds: 35,
    profiles: [{ id: 'low-vision', severity }],
    guidelines: [
      { name: 'Reflow', number: '1.4.10', level: 'AA' },
      { name: 'Resize Text', number: '1.4.4', level: 'AA' },
      { name: 'Contrast (Minimum)', number: '1.4.3', level: 'AA' },
      { name: 'Non-text Contrast', number: '1.4.11', level: 'AA' },
      { name: 'Text Spacing', number: '1.4.12', level: 'AA' }
    ]
  }
}

export const CARD_SECTIONS = [
  { mode: 'automated', id: 'section-automated', title: 'Choose who to watch' },
  { mode: 'extension', id: 'section-extension', title: 'Choose whose experience to step into' },
  { mode: 'later', id: 'section-later', title: 'Others and coming soon' }
]

export function cardTitle(card) {
  return card.kind === 'situation' ? card.name : `${card.name}, ${card.age}, ${card.experience}`
}

export function getCard(id) {
  return PERSONA_CARDS.find((c) => c.id === id)
}

// The first card of a built-in person, by name (their place and colour live on it).
export function personCard(personaName) {
  return PERSONA_CARDS.find((c) => c.personaName === personaName) || null
}

export function avatarColorFor(personaName) {
  return personCard(personaName)?.avatarColor || null
}

const DEFAULT_PRONOUNS = { subject: 'they', object: 'them', possessive: 'their' }

// Fills the pronoun tokens in card copy. Pronouns come from the persona
// record (set by the product owner); anything missing is they/them/their.
export function fillPronouns(text, pronouns) {
  const p = { ...DEFAULT_PRONOUNS, ...(pronouns || {}) }
  const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1)
  return String(text)
    .replaceAll('{they}', p.subject)
    .replaceAll('{them}', p.object)
    .replaceAll('{their}', p.possessive)
    .replaceAll('{Their}', cap(p.possessive))
}
