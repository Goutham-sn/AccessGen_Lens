// Calibration: after the timing mark sets this run's correction and cut
// (see src/videoSync.js), do things appear in the delivered video at the
// video time the runner maps them to? And is the mark gone from it?
//   docker compose run --rm runner node scripts/calibrate.js
// Flashes the whole page magenta at three known times, records and delivers
// the video exactly as the recorded pass does, then finds the first magenta
// frame for each flash. Exits 1 if any lands outside the tolerance in
// measuringStick.js, or if any trace of the mark is left.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import { config } from '../src/config.js'
import { settle, installOverlay } from '../src/pageScripts.js'
import { showSyncMark, readPageCorner, deliverVideo } from '../src/videoSync.js'
import { stick } from '../src/measuringStick.js'
import { extractFrames, pixelsOf, isMagenta } from '../test/helpers.js'

const FLASH_AT_MS = [1200, 2600, 4000] // after the mark, which takes about 0.7 s
const FLASH_FOR_MS = 400
const tolerance = stick('calibration', 'toleranceMs')

const work = await fs.mkdtemp(path.join(os.tmpdir(), 'calibrate-'))
const browser = await chromium.launch({ chromiumSandbox: true })
const context = await browser.newContext({
  viewport: config.viewport, recordVideo: { dir: work, size: config.viewport }
})
await context.route('https://calibrate.lens.test/**', (route) => route.fulfill({
  status: 200, contentType: 'text/html',
  body: '<!doctype html><title>Calibrate</title><style>html,body{margin:0;height:100%;background:#fff}</style><body></body>'
}))

const videoStart = Date.now()
const page = await context.newPage()
await page.goto('https://calibrate.lens.test/')
await page.waitForTimeout(1500) // like a page load, so there is something to trim
await page.evaluate(installOverlay)
await page.evaluate(settle)
const readyAt = Date.now()
const pageCorner = await readPageCorner(browser, page)
const mark = await showSyncMark(page)

const expected = []
for (const at of FLASH_AT_MS) {
  const wait = readyAt + at - Date.now()
  if (wait > 0) await page.waitForTimeout(wait)
  // Same convention as the evidence engine: draw, wait two frames, stamp.
  await page.evaluate(() => { document.body.style.background = '#ff00ff' })
  await page.evaluate(settle)
  expected.push(Date.now()) // wall time, mapped onto the delivered video below
  await page.waitForTimeout(FLASH_FOR_MS)
  await page.evaluate(() => { document.body.style.background = '#ffffff' })
  await page.evaluate(settle)
}
await page.waitForTimeout(500)
const videoPath = await page.video().path()
await context.close()

const delivered = await deliverVideo({ browser, rawPath: videoPath, videoStart, readyAt, mark, pageCorner })
const frames = await extractFrames(delivered.file, path.join(work, 'frames'))
const decoder = await browser.newPage()
const magentaAt = []
for (const f of frames) {
  const px = await pixelsOf(decoder, await fs.readFile(f.file), [[640, 360]])
  magentaAt.push({ ms: f.ms, on: isMagenta(px.pixels[0]) })
}
await browser.close()

// Onset of each flash: first magenta frame after a non-magenta one.
const onsets = []
for (let i = 0; i < magentaAt.length; i++) {
  if (magentaAt[i].on && (i === 0 || !magentaAt[i - 1].on)) onsets.push(magentaAt[i].ms)
}

const sync = delivered.sync
console.log(`cut ${sync.cutMs} ms; ${frames.length} frames; tolerance ${tolerance} ms`)
console.log(`timing mark: found ${sync.found}, measured ${sync.measuredMs ?? '-'} ms, applied ${sync.applied}${sync.recut ? ', cut again' : ''}`)
let failed = sync.found && sync.applied ? 0 : 1
console.log(`${sync.noMarkInVideo ? 'PASS' : 'FAIL'}  no trace of the timing mark in the delivered video`)
if (!sync.noMarkInVideo) failed++
expected.forEach((wall, i) => {
  const exp = Math.round(delivered.toVideoMs(wall))
  const seen = onsets[i]
  const diff = seen == null ? null : seen - exp
  const ok = diff !== null && Math.abs(diff) <= tolerance
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  flash ${i + 1}: mapped to ${exp} ms, first seen ${seen ?? 'never'} ms${diff === null ? '' : ` (${diff >= 0 ? '+' : ''}${diff} ms)`}`)
})
if (onsets.length !== expected.length) {
  failed++
  console.log(`FAIL  expected ${expected.length} flashes in the video, found ${onsets.length}`)
}
await fs.rm(work, { recursive: true, force: true })
process.exit(failed ? 1 : 0)
