// Calibration: after the per-run correction from the timing mark (see
// src/videoSync.js), is "video time" (Date.now() - readyAt, as the evidence
// engine stamps it) where things really appear in the saved, trimmed video?
//   docker compose run --rm runner node scripts/calibrate.js
// Flashes the whole page magenta at three known times, records it exactly as
// the recorded pass does (same context options, same trim), then finds the
// first magenta frame for each flash. Exits 1 if any lands outside the
// tolerance in measuringStick.js.
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { chromium } from 'playwright'
import { config } from '../src/config.js'
import { settle, installOverlay } from '../src/pageScripts.js'
import { showSyncMark, findSyncOnset } from '../src/videoSync.js'
import { trimStart } from '../src/trim.js'
import { stick } from '../src/measuringStick.js'
import { extractFrames, pixelsOf, isMagenta } from '../test/helpers.js'

const FLASH_AT_MS = [800, 2200, 3600]
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
const syncAt = (await showSyncMark(page)) - readyAt

const expected = []
for (const at of FLASH_AT_MS) {
  const wait = readyAt + at - Date.now()
  if (wait > 0) await page.waitForTimeout(wait)
  // Same convention as the evidence engine: draw, wait two frames, stamp.
  await page.evaluate(() => { document.body.style.background = '#ff00ff' })
  await page.evaluate(settle)
  expected.push(Date.now() - readyAt)
  await page.waitForTimeout(FLASH_FOR_MS)
  await page.evaluate(() => { document.body.style.background = '#ffffff' })
  await page.evaluate(settle)
}
await page.waitForTimeout(500)
const videoPath = await page.video().path()
await context.close()

const trimMs = readyAt - videoStart
const trimmed = await trimStart(videoPath, trimMs)
if (!trimmed) {
  console.log('FAIL  could not trim the video')
  process.exit(1)
}
const onset = await findSyncOnset(browser, trimmed)
const correction = onset === null ? 0 : onset - syncAt
const frames = await extractFrames(trimmed, path.join(work, 'frames'))
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

console.log(`trimmed ${trimMs} ms of loading; ${frames.length} frames; tolerance ${tolerance} ms`)
console.log(`timing mark: stamped ${syncAt} ms, seen ${onset ?? 'never'} ms, correction ${correction} ms`)
let failed = onset === null ? 1 : 0
expected.forEach((stamped, i) => {
  const exp = stamped + correction
  const seen = onsets[i]
  const diff = seen == null ? null : seen - exp
  const ok = diff !== null && Math.abs(diff) <= tolerance
  if (!ok) failed++
  console.log(`${ok ? 'PASS' : 'FAIL'}  flash ${i + 1}: stamped ${stamped} ms, corrected ${exp} ms, first seen ${seen ?? 'never'} ms${diff === null ? '' : ` (${diff >= 0 ? '+' : ''}${diff} ms)`}`)
})
if (onsets.length !== expected.length) {
  failed++
  console.log(`FAIL  expected ${expected.length} flashes in the video, found ${onsets.length}`)
}
await fs.rm(work, { recursive: true, force: true })
process.exit(failed ? 1 : 0)
