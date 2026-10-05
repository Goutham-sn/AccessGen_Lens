import { query } from './database.js'

const BUILT_IN_PERSONAS = [
  {
    name: 'Meera', age: 72,
    story: 'Retired schoolteacher who started using the internet to video call her grandchildren. Has age-related macular degeneration and a mild hand tremor that has worsened over the past year.',
    profiles: [
      { id: 'macular-degeneration', severity: 2 },
      { id: 'tremor', severity: 1 },
      { id: 'low-vision', severity: 1 }
    ]
  },
  {
    name: 'David', age: 38,
    story: 'Software architect born with Deuteranopia. High technical literacy and a fast keyboard user. Has adapted completely to colorblindness but still encounters sites that use color alone to communicate.',
    profiles: [
      { id: 'deuteranopia', severity: 3 },
      { id: 'keyboard-only', severity: 3 }
    ]
  },
  {
    name: 'Ananya', age: 19,
    story: 'First-year engineering student with dyslexia and ADHD diagnosed at age 12. Bright, capable, and passionate about technology. Struggles with dense text, cluttered layouts, and sites that compete for her attention.',
    profiles: [
      { id: 'dyslexia', severity: 2 },
      { id: 'adhd', severity: 2 }
    ]
  },
  {
    name: 'Thomas', age: 51,
    story: 'Former construction site manager who had a stroke two years ago affecting his right hand and peripheral vision. Determined to remain independent and stay active online.',
    profiles: [
      { id: 'tremor', severity: 2 },
      { id: 'tunnel-vision', severity: 2 },
      { id: 'low-vision', severity: 1 }
    ]
  },
  {
    name: 'Fatima', age: 29,
    story: 'Deaf community advocate and content creator. Full visual ability. Relies entirely on captions, transcripts, and text for all media. Encounters uncaptioned video as a complete blocker daily.',
    profiles: [{ id: 'deaf', severity: 3 }]
  },
  {
    name: 'Ravi', age: 65,
    story: "Retired bank manager with Parkinson's disease diagnosed three years ago. Uses the computer for news, banking, and staying connected. His tremor has been worsening and sessions fatigue him quickly.",
    profiles: [
      { id: 'tremor', severity: 3 },
      { id: 'low-vision', severity: 2 }
    ]
  },
  {
    name: 'James', age: 32,
    story: 'Blind since birth. Uses NVDA screen reader and keyboard navigation for everything. Expert user who can navigate complex sites efficiently when they are built correctly, and is immediately blocked when they are not.',
    profiles: [
      { id: 'screen-reader', severity: 3 },
      { id: 'keyboard-only', severity: 3 }
    ]
  }
]

export async function seedBuiltInPersonas() {
  // Earlier versions deleted and re-inserted built-ins on every boot, which
  // left some runner sessions pointing at ids that no longer exist. Point
  // those back at the built-in they were made from, matched on the name and
  // story kept in their snapshot. Runs before the upsert below, while the
  // stored story still matches what those snapshots captured.
  const { rowCount } = await query(
    `UPDATE sessions s SET persona_id = p.id
       FROM personas p
      WHERE p.is_built_in
        AND s.persona_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM personas x WHERE x.id = s.persona_id)
        AND p.name = s.persona_snapshot->>'name'
        AND p.story = s.persona_snapshot->>'story'`
  )

  // Upsert by name so a built-in persona keeps the same id across restarts:
  // runner sessions point at it through persona_id. Definition changes
  // (story, profiles) still reach a running database. Built-ins that leave
  // this list are left in place rather than deleted, so nothing that points
  // at them is orphaned. User-created personas are never touched.
  for (const p of BUILT_IN_PERSONAS) {
    await query(
      `INSERT INTO personas (name, age, story, profiles, is_built_in, is_public)
       VALUES ($1, $2, $3, $4, TRUE, TRUE)
       ON CONFLICT (name) WHERE is_built_in
       DO UPDATE SET age = EXCLUDED.age, story = EXCLUDED.story,
                     profiles = EXCLUDED.profiles, is_public = TRUE`,
      [p.name, p.age, p.story, JSON.stringify(p.profiles)]
    )
  }
  console.log(`[seed] ${BUILT_IN_PERSONAS.length} built-in personas up to date` +
    (rowCount ? `, ${rowCount} session(s) re-linked` : ''))
}
