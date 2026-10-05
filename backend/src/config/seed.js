import { query } from './database.js'
import { BUILT_IN_PERSONAS } from './builtInPersonas.js'

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
      `INSERT INTO personas (name, age, story, profiles, is_built_in, is_public, pronouns)
       VALUES ($1, $2, $3, $4, TRUE, TRUE, COALESCE($5::jsonb, '{"subject":"they","object":"them","possessive":"their"}'::jsonb))
       ON CONFLICT (name) WHERE is_built_in
       DO UPDATE SET age = EXCLUDED.age, story = EXCLUDED.story,
                     profiles = EXCLUDED.profiles, is_public = TRUE, pronouns = EXCLUDED.pronouns`,
      [p.name, p.age, p.story, JSON.stringify(p.profiles), p.pronouns ? JSON.stringify(p.pronouns) : null]
    )
  }
  console.log(`[seed] ${BUILT_IN_PERSONAS.length} built-in personas up to date` +
    (rowCount ? `, ${rowCount} session(s) re-linked` : ''))
}
