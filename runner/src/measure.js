import { tabWalk } from './walk.js'
import { makeFinding } from './evidence.js'
import { releaseProbe, installFocusRecord, clearFocusRecord, readFlashed } from './checks/keyboard/probe.js'
import { coverageLines } from './copy.js'

// The hidden measure pass's detector run: no video, no overlay, no filter.
// Shared by the persona flow, the check fixtures and the validation script,
// so all three measure exactly the same way.
//
// Each detector may have:
//   beforeWalk(ctx)            once, after load, before the first Tab
//   onStop({ ...ctx, stop, step })  at each Tab stop, before the next press
//   measure({ ...ctx, stops, walk })  once, after the walk
// ctx: { page, persona, profileIds, note }. note(line) adds a plain line to
// "what we could not look at"; the same line is kept once.
//
// Findings are candidates only; the recorded pass confirms them.
export async function measurePass(page, { detectors, deadline, persona, profileIds = [], walks = true, onWalked } = {}) {
  const notes = []
  const problems = []
  const candidates = []
  const note = (line) => { if (!notes.includes(line)) notes.push(line) }
  const ctx = { page, persona, profileIds, note }
  const problem = (d, err, step) => problems.push({
    detector: d.id, ...(step ? { step } : {}), message: String(err?.message || err).slice(0, 300)
  })

  try {
    for (const d of detectors) {
      if (!d.beforeWalk) continue
      try { await d.beforeWalk(ctx) } catch (err) { problem(d, err) }
    }

    let walk = null
    if (walks) {
      // Records which element gets focus during each press (it changes
      // nothing), so a press that ends on the page itself can name the
      // element that had focus for a moment.
      await page.evaluate(installFocusRecord).catch(() => {})
      walk = await tabWalk(page, {
        deadline,
        beforePress: () => page.evaluate(clearFocusRecord).catch(() => {}),
        afterPress: async (stop) => (stop.kind === 'body' ? { flashed: await readFlashed(page) } : null),
        onStop: async (stop, step) => {
          for (const d of detectors) {
            if (!d.onStop) continue
            try {
              for (const f of (await d.onStop({ ...ctx, stop, step })) || []) candidates.push(makeFinding({ ...f, step }))
            } catch (err) {
              problem(d, err, step)
            }
          }
        }
      })
      onWalked?.()
      const last = walk.stops[walk.stops.length - 1]
      if (last?.kind === 'frame' && (walk.ended === 'max' || walk.ended === 'time')) note(coverageLines.stayedInFrame)
      if (walk.ended === 'max' && walk.more) note(coverageLines.stopLimit(walk.presses))
      if (walk.ended === 'time') note(coverageLines.outOfTime(walk.stops.length))
    }

    for (const d of detectors) {
      if (!d.measure) continue
      try {
        for (const f of (await d.measure({ ...ctx, stops: walk?.stops ?? null, walk })) || []) candidates.push(makeFinding(f))
      } catch (err) {
        problem(d, err)
      }
    }
    return { walk, candidates, notes, problems }
  } finally {
    await releaseProbe(page)
  }
}
