import path from 'node:path'
import { serveFixtureDir, FIXTURE_HOST } from '../fixtureServer.js'
import { measurePass } from '../../measure.js'

// Runs all five keyboard detectors together on each fixture page, as a
// keyboard persona would, and reports what one of them found. expected.json
// maps a page to the fields to compare: findings (a count), steps (the stop
// of each finding, null for page-level ones) and notes (coverage lines).
// With `details`, the headline and fact of each finding are added, for
// reviewing the wording.
//
// Each page is measured once per browser and shared by the five checks,
// since all five measure it together anyway.
const runs = new WeakMap() // browser -> Map(page path -> measure run)

async function measureFixture(browser, file) {
  const { KEYBOARD_CHECKS } = await import('../index.js')
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } })
  try {
    await serveFixtureDir(context, path.dirname(file))
    const page = await context.newPage()
    await page.goto(`${FIXTURE_HOST}/${path.basename(file)}`)
    const run = await measurePass(page, {
      detectors: KEYBOARD_CHECKS,
      deadline: Date.now() + 60000,
      persona: { persona: { name: 'David' } }
    })
    if (run.problems.length) throw new Error(`${path.basename(file)}: ${JSON.stringify(run.problems)}`)
    // A walk cut short by the time limit (a slow or overloaded machine) would
    // otherwise show up as missing findings; say what happened instead.
    if (run.walk?.ended === 'time') throw new Error(`${path.basename(file)}: the walk reached the 60 s limit after ${run.walk.stops.length} stops`)
    return { candidates: run.candidates, notes: run.notes, ended: run.walk?.ended ?? null }
  } finally {
    await context.close()
  }
}

export function measureFixtureOnce(browser, file) {
  if (!runs.has(browser)) runs.set(browser, new Map())
  const cache = runs.get(browser)
  if (!cache.has(file)) cache.set(file, measureFixture(browser, file))
  return cache.get(file)
}

export async function runKeyboardFixture(browser, { fixtureDir, expected, details = false }, id) {
  const result = {}
  for (const file of Object.keys(expected)) {
    const run = await measureFixtureOnce(browser, path.resolve(fixtureDir, file))
    const mine = run.candidates.filter((f) => f.detector === id)
    const all = { findings: mine.length, steps: mine.map((f) => f.step ?? null), notes: run.notes }
    const out = {}
    for (const key of Object.keys(expected[file])) out[key] = all[key]
    if (details) out.details = mine.map((f) => ({ headline: f.headline, fact: f.fact, forTeam: f.forTeam }))
    result[file] = out
  }
  return result
}
