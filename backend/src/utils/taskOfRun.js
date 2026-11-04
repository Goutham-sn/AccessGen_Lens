// How a task run shows up in the run page's data. Both read stored JSON, so
// they check its shape rather than trust it.

// The goal and the things to find, as { goal, intents } or null for a run
// that was not a task run.
export function taskOf(stored) {
  if (!stored || typeof stored !== 'object') return null
  const { goal, intents } = stored
  if (typeof goal !== 'string' || !Array.isArray(intents) || !intents.every((t) => typeof t === 'string')) return null
  return { goal, intents }
}

// How far one person got: { reached, intents, ended }, or null when the
// session has no task result (not a task run). `ended` is null when the walk
// never ran (the page did not open), and then reached means nothing.
export function taskProgress(coverage) {
  const t = coverage?.task
  if (!t || !Number.isInteger(t.intents) || !Number.isInteger(t.reached)) return null
  return { reached: t.reached, intents: t.intents, ended: typeof t.ended === 'string' ? t.ended : null }
}
