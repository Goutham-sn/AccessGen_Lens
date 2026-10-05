// Built-in personas: the one list used by the database seed and by the
// web app's card coverage test. Plain data, no imports.
//
// pronouns: set by the product owner, for example
//   { subject: 'she', object: 'her', possessive: 'her' }
// Used only in card stories. null means they/them/their.
export const BUILT_IN_PERSONAS = [
  {
    name: 'Meera', age: 72,
    pronouns: null,
    story: 'Retired schoolteacher who started using the internet to video call her grandchildren. Has age-related macular degeneration and a mild hand tremor that has worsened over the past year.',
    profiles: [
      { id: 'macular-degeneration', severity: 2 },
      { id: 'tremor', severity: 1 },
      { id: 'low-vision', severity: 1 }
    ]
  },
  {
    name: 'David', age: 38,
    pronouns: null,
    story: 'Software architect born with Deuteranopia. High technical literacy and a fast keyboard user. Has adapted completely to colorblindness but still encounters sites that use color alone to communicate.',
    profiles: [
      { id: 'deuteranopia', severity: 3 },
      { id: 'keyboard-only', severity: 3 }
    ]
  },
  {
    name: 'Ananya', age: 19,
    pronouns: null,
    story: 'First-year engineering student with dyslexia and ADHD diagnosed at age 12. Bright, capable, and passionate about technology. Struggles with dense text, cluttered layouts, and sites that compete for her attention.',
    profiles: [
      { id: 'dyslexia', severity: 2 },
      { id: 'adhd', severity: 2 }
    ]
  },
  {
    name: 'Thomas', age: 51,
    pronouns: null,
    story: 'Former construction site manager who had a stroke two years ago affecting his right hand and peripheral vision. Determined to remain independent and stay active online.',
    profiles: [
      { id: 'tremor', severity: 2 },
      { id: 'tunnel-vision', severity: 2 },
      { id: 'low-vision', severity: 1 }
    ]
  },
  {
    name: 'Fatima', age: 29,
    pronouns: null,
    story: 'Deaf community advocate and content creator. Full visual ability. Relies entirely on captions, transcripts, and text for all media. Encounters uncaptioned video as a complete blocker daily.',
    profiles: [{ id: 'deaf', severity: 3 }]
  },
  {
    name: 'Ravi', age: 65,
    pronouns: null,
    story: "Retired bank manager with Parkinson's disease diagnosed three years ago. Uses the computer for news, banking, and staying connected. His tremor has been worsening and sessions fatigue him quickly.",
    profiles: [
      { id: 'tremor', severity: 3 },
      { id: 'low-vision', severity: 2 }
    ]
  },
  {
    name: 'James', age: 32,
    pronouns: null,
    story: 'Blind since birth. Uses NVDA screen reader and keyboard navigation for everything. Expert user who can navigate complex sites efficiently when they are built correctly, and is immediately blocked when they are not.',
    profiles: [
      { id: 'screen-reader', severity: 3 },
      { id: 'keyboard-only', severity: 3 }
    ]
  }
]
